---
name: database
description: Use when writing or changing Supabase/PostgreSQL schema, migrations, RLS policies, or queries.
---

# Database

Supabase / PostgreSQL. Read `docs/DATABASE.md` and `docs/SECURITY.md` first.

## Rules

- All schema changes are migrations under `supabase/migrations/`, applied in filename order —
  never hand-edit the database out of band without a matching migration file.
- UUID primary keys, foreign keys, timestamps, indexes on frequently queried columns.
- Row Level Security is enabled on every table with no permissive policies
  (`supabase/migrations/0003_rls.sql`). Access is via the service-role key only, from n8n or a
  Next.js server route — never a browser client. Do not add a permissive RLS policy without first
  updating `docs/SECURITY.md` and `docs/ARCHITECTURE.md` to reflect why the access model changed.
- pgvector: the `hnsw` index on `knowledge_chunks.embedding` and the `match_knowledge_chunks` RPC
  in `supabase/migrations/0002_pgvector_and_rag.sql` are required for retrieval to actually
  perform well, not optional polish — see `docs/DATABASE.md`.
- Use normalized relational structure for structured data; JSONB only where flexibility is
  genuinely needed (`action_plan`, `metadata`).
- All queries parameterized. Never string-concatenate SQL, in application code or n8n nodes.
- Never expose the service-role key to the browser.
