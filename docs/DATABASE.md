# Database

Supabase / PostgreSQL. All migrations live in `supabase/migrations/`, applied in filename order.
Seed data lives in `supabase/seed/`.

## Rules

- UUID primary keys, foreign keys, timestamps on every table.
- Indexes on frequently queried columns (`treatment`, `last_visit`, `rebooked`, `clinic_id`).
- JSONB only where flexibility is genuinely useful (`action_plan`, `metadata`) — not as a default.
- Every table has Row Level Security enabled with no permissive policies (see
  `supabase/migrations/0003_rls.sql` and `docs/SECURITY.md`). Access is via the service-role key
  from n8n or a Next.js server route only.
- Never expose the service-role key to the browser.
- All queries parameterized — no string-concatenated SQL, in application code or in n8n.

## Schema overview

```
clinics
  |
  +-- customers
  |
  +-- knowledge_documents
  |       +-- knowledge_chunks (pgvector)
  |
  +-- coaching_sessions
          +-- messages
          +-- action_plans
```

See `supabase/migrations/0001_init_schema.sql` for the full DDL.

## pgvector setup (this is the part that's easy to leave half-done)

Three things are required for RAG retrieval to actually work in production, not just look correct
in a schema diagram:

1. **Enable the extension** — `create extension if not exists vector with schema extensions;`
2. **An ANN index on the embedding column** — without one, every query does a full sequential scan
   over `knowledge_chunks`. Use `hnsw` for this project's scale (a handful of documents, read-heavy
   at demo time, we want accuracy over raw ingest speed) rather than `ivfflat` (better suited to
   very large, bulk-loaded datasets):
   ```sql
   create index knowledge_chunks_embedding_idx
     on knowledge_chunks
     using hnsw (embedding vector_cosine_ops);
   ```
3. **A `match_documents`-style RPC function** — n8n's Postgres node can call a Postgres function
   directly, which is the clean way to do vector search from a workflow without hand-writing the
   `<=>` distance operator into a raw SQL node every time. See
   `supabase/migrations/0002_pgvector_and_rag.sql` for `match_knowledge_chunks(...)`; call it from
   n8n (or the Next.js server-side Supabase client, if ever needed) via
   `supabase.rpc('match_knowledge_chunks', { query_embedding, match_clinic_id, match_count })`.

Set the embedding column's dimension to match whatever embedding model `docs/AI_AGENT.md`
specifies — the migration uses a placeholder that must be updated before the first ingestion run,
not left as a guess.

## Example customer record

```
Maria Santos — CoolSculpting — Dr. Reyes — Consultation: Completed — Purchase: No
Amount: 0 — Last Visit: 2026-06-14 — Rebooked: No — Satisfaction: 4
```

This makes "which treatment has poor conversion?" a SQL problem, not a vector-search problem —
that distinction is exactly what the 12% Data/RAG/Tool-Usage rubric line is checking for.

## Seed data

Target: 100 synthetic customers (minimum is 50 — see `docs/PROJECT_SPEC.md`), generated with
**intentional patterns**, not pure randomness, so the demo scenarios in `docs/PROJECT_SPEC.md`
actually surface something to talk about:

- CoolSculpting: high consultation volume, low purchase conversion (the "money shot" demo).
- Botox: high conversion, high rebooking.
- HydraFacial: moderate conversion, low rebooking.
- Laser Hair Removal: good conversion, lower satisfaction.
- A meaningful cluster of customers >90 days since last visit and not rebooked (for the
  "who needs follow-up?" demo).

The generator script (to be implemented under `src/scripts/` or `supabase/seed/`, in TypeScript or
SQL) must be deterministic (fixed seed) so re-running it during development doesn't quietly change
the demo story.
