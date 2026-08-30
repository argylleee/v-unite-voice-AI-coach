-- 0002_pgvector_and_rag.sql
-- Knowledge base + pgvector setup. See docs/DATABASE.md and docs/RAG.md.

create extension if not exists vector with schema extensions;

create table if not exists knowledge_documents (
    id uuid primary key default gen_random_uuid(),
    clinic_id uuid not null references clinics(id) on delete cascade,

    filename text not null,
    file_type text not null check (file_type in ('pdf', 'txt')),

    status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),

    created_at timestamptz not null default now()
);

create index if not exists knowledge_documents_clinic_id_idx on knowledge_documents(clinic_id);

-- IMPORTANT: the vector dimension below (1536) is a placeholder matching OpenAI-style
-- text-embedding-3-small. If docs/AI_AGENT.md specifies a different embedding model, update this
-- dimension BEFORE the first ingestion run — changing it later means re-embedding everything.
create table if not exists knowledge_chunks (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references knowledge_documents(id) on delete cascade,
    clinic_id uuid not null references clinics(id) on delete cascade,

    content text not null,
    chunk_index integer not null,

    embedding extensions.vector(1536),

    metadata jsonb,

    created_at timestamptz not null default now()
);

create index if not exists knowledge_chunks_document_id_idx on knowledge_chunks(document_id);
create index if not exists knowledge_chunks_clinic_id_idx on knowledge_chunks(clinic_id);

-- ANN index for retrieval. HNSW: better recall at our scale (a handful of clinic documents,
-- read-heavy at demo time) than IVFFlat, which wants a much larger, bulk-loaded corpus to pay off.
create index if not exists knowledge_chunks_embedding_idx
    on knowledge_chunks
    using hnsw (embedding extensions.vector_cosine_ops);

-- RPC used by n8n's Postgres node (and, if ever needed, a Next.js server route) to do similarity
-- search without hand-writing the distance operator into every workflow. Filters by clinic_id so
-- retrieval never crosses clinics even though this MVP seeds only one.
create or replace function match_knowledge_chunks (
    query_embedding extensions.vector(1536),
    match_clinic_id uuid,
    match_count int default 5,
    match_threshold float default 0.5
)
returns table (
    id uuid,
    document_id uuid,
    content text,
    metadata jsonb,
    similarity float
)
language sql stable
as $$
    select
        knowledge_chunks.id,
        knowledge_chunks.document_id,
        knowledge_chunks.content,
        knowledge_chunks.metadata,
        1 - (knowledge_chunks.embedding <=> query_embedding) as similarity
    from knowledge_chunks
    where knowledge_chunks.clinic_id = match_clinic_id
      and 1 - (knowledge_chunks.embedding <=> query_embedding) > match_threshold
    order by knowledge_chunks.embedding <=> query_embedding asc
    limit least(match_count, 20);
$$;

-- action_plans as its own table (in addition to coaching_sessions.action_plan jsonb) so a
-- session can be given more than one structured action item with independent status tracking.
-- Keep both: coaching_sessions.action_plan is the generated summary payload; action_plans rows
-- are the checkable items derived from it.
create table if not exists action_plans (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references coaching_sessions(id) on delete cascade,

    action text not null,
    priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
    done boolean not null default false,

    created_at timestamptz not null default now()
);

create index if not exists action_plans_session_id_idx on action_plans(session_id);
