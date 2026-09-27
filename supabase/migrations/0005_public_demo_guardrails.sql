-- Isolate each public demo visitor's sessions and atomically bound costly requests.
alter table clinics add column if not exists demo_synthetic boolean not null default false;
alter table coaching_sessions add column if not exists visitor_token_hash text;
alter table knowledge_documents add column if not exists visitor_token_hash text;
alter table knowledge_documents add column if not exists demo_curated boolean not null default false;
alter table knowledge_chunks add column if not exists visitor_token_hash text;
create index if not exists coaching_sessions_visitor_idx
  on coaching_sessions (clinic_id, visitor_token_hash, started_at desc);
create index if not exists knowledge_documents_visitor_idx
  on knowledge_documents (clinic_id, visitor_token_hash, created_at desc);

-- Existing documents start hidden until an operator verifies that they are synthetic.
-- Public uploads remain private to their visitor.
drop function if exists match_knowledge_chunks(extensions.vector, uuid, int, float);
create or replace function match_knowledge_chunks (
  query_embedding extensions.vector(1024),
  match_clinic_id uuid,
  match_count int default 5,
  match_threshold float default 0.5,
  match_visitor_hash text default null
) returns table (id uuid, document_id uuid, content text, metadata jsonb, similarity float)
language sql stable as $$
  select kc.id, kc.document_id, kc.content, kc.metadata,
         1 - (kc.embedding <=> query_embedding) as similarity
  from knowledge_chunks kc
  join knowledge_documents kd on kd.id = kc.document_id and kd.clinic_id = match_clinic_id
  where kc.clinic_id = match_clinic_id
    and kd.status = 'ready'
    and (kd.demo_curated = true or (match_visitor_hash is not null and kd.visitor_token_hash = match_visitor_hash))
    and 1 - (kc.embedding <=> query_embedding) > match_threshold
  order by kc.embedding <=> query_embedding asc
  limit least(match_count, 20);
$$;

create table if not exists demo_rate_limits (
  fingerprint text not null,
  action text not null,
  window_start timestamptz not null,
  count integer not null check (count > 0),
  primary key (fingerprint, action, window_start)
);
create index if not exists demo_rate_limits_window_idx on demo_rate_limits (window_start);
alter table demo_rate_limits enable row level security;

create or replace function reserve_demo_rate_limit(
  p_fingerprint text, p_action text, p_window_start timestamptz, p_limit integer
) returns boolean language plpgsql volatile as $$
declare allowed boolean;
begin
  if length(p_fingerprint) != 64 or p_limit < 1 or p_limit > 100 then
    raise exception 'invalid rate limit arguments';
  end if;
  delete from demo_rate_limits where window_start < now() - interval '2 days';
  insert into demo_rate_limits (fingerprint, action, window_start, count)
  values (p_fingerprint, p_action, p_window_start, 1)
  on conflict (fingerprint, action, window_start)
  do update set count = demo_rate_limits.count + 1
    where demo_rate_limits.count < p_limit
  returning true into allowed;
  return coalesce(allowed, false);
end;
$$;

-- One transaction for the session summary and its checkable action rows.
create or replace function finalize_demo_session(
  p_session_id uuid,
  p_clinic_id uuid,
  p_visitor_token_hash text,
  p_summary text,
  p_key_findings jsonb,
  p_action_plan jsonb
) returns void language plpgsql volatile as $$
begin
  update coaching_sessions
  set ended_at = now(), summary = p_summary,
      key_findings = p_key_findings, action_plan = p_action_plan
  where id = p_session_id and clinic_id = p_clinic_id
    and visitor_token_hash = p_visitor_token_hash and ended_at is null;
  if not found then
    raise exception 'session_not_found_or_already_ended';
  end if;

  insert into action_plans (session_id, action, priority)
  select p_session_id, item->>'action', item->>'priority'
  from jsonb_array_elements(p_action_plan) as item;
end;
$$;
