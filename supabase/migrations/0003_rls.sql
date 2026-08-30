-- 0003_rls.sql
-- Default-deny Row Level Security on every application table.
--
-- Decision (see docs/ARCHITECTURE.md #2 and docs/SECURITY.md): this app has no browser-side
-- Supabase client and no end-user auth. All reads/writes go through n8n or a Next.js server
-- route using the service-role key, which bypasses RLS entirely. Enabling RLS with zero
-- permissive policies costs nothing operationally and means a leaked anon key, or a future
-- accidental client-side Supabase call, exposes zero rows instead of the whole customer
-- database. Do not add permissive policies unless a real client-side access pattern is
-- introduced later (e.g. real end-user auth) and reviewed against docs/SECURITY.md first.

alter table clinics enable row level security;
alter table customers enable row level security;
alter table knowledge_documents enable row level security;
alter table knowledge_chunks enable row level security;
alter table coaching_sessions enable row level security;
alter table messages enable row level security;
alter table action_plans enable row level security;

-- No policies are created here on purpose. With RLS enabled and no policies, every role except
-- the service role (which bypasses RLS by design in Postgres/Supabase) gets zero rows.
