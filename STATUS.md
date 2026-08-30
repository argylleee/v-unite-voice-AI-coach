# Development Status

Update this when a milestone is actually done and verified — not when it's started. See
`docs/DEVELOPMENT_PLAN.md` for what each phase includes.

## Phase 1 — Foundation
- [x] Next.js (App Router) + TypeScript + Tailwind v4 + ESLint + Vitest + Playwright
- [x] Supabase project created; all 3 migrations applied via `npm run db:migrate`
      (verified: 7 tables present, pgvector extension + hnsw index + `match_knowledge_chunks` RPC)
- [x] Seed script: deterministic generator for 100 patterned customer records
      (`src/lib/seed/`, `npm run seed`), unit-tested for the CoolSculpting-low-conversion /
      Botox-high-rebooking / lapsed-customer-cluster patterns. Live-seeded: 1 clinic
      ("V-Unite Aesthetic Clinic"), 100 customers, 30 CoolSculpting.
- [ ] CI green on an empty-but-real app — all CI steps pass locally (lint, typecheck, unit,
      integration [none yet], build, e2e smoke); needs a GitHub remote + push to confirm on Actions

### Phase 1 notes
- `git init` done on branch `main`; no GitHub remote yet — create one and push.
- Embedding vector dimension in `0002_pgvector_and_rag.sql` is still the 1536 placeholder;
  set it in Phase 4 once the embedding model is chosen (`docs/AI_AGENT.md`).
- `.env.example` gained `SUPABASE_DB_URL` and `SEED_CLINIC_NAME`. `SUPABASE_DB_URL` must be
  the Supabase **session pooler** string (port 5432, `aws-0-*.pooler.supabase.com`) — the
  direct-connection host is IPv6-only and won't resolve on most networks.

## Phase 2 — n8n plumbing
- [ ] Webhook auth working end to end (Next.js -> n8n -> Supabase -> response)

## Phase 3 — Structured AI agent
- [ ] AI Agent node + customer_analytics, customer_lookup, kpi_calculator tools
- [ ] "Which treatment needs attention?" works
- [ ] "Which customers need follow-up?" works

## Phase 4 — RAG
- [ ] PDF ingestion
- [ ] TXT ingestion
- [ ] knowledge_search tool wired to AI Agent
- [ ] "What does our SOP say?" works, with source citation

## Phase 5 — Hybrid reasoning
- [ ] SQL + RAG combined question produces specific, evidence-based coaching

## Phase 6 — Voice
- [ ] MediaRecorder output confirmed compatible with Fish Audio STT (real test clip, not assumed)
- [ ] STT -> agent -> TTS working end to end
- [ ] All required voice UI states implemented

## Phase 7 — Sessions
- [ ] Sessions + messages persisted
- [ ] End-of-session summary + action plan generated and saved

## Phase 8 — UI (Impeccable)
- [ ] `/impeccable init` run, PRODUCT.md + DESIGN.md committed
- [ ] Required screens built and passed through shape/critique/audit/polish
- [ ] `npx impeccable detect` clean

## Phase 9 — QA
- [ ] Unit tests
- [ ] Integration test
- [ ] E2E/smoke test
- [ ] Failure/regression test (missing-knowledge hallucination case)
- [ ] CI fully green

## Phase 10 — Deployment
- [ ] Deployed to Vercel
- [ ] All env vars set in Vercel
- [ ] Vercel Deployment Checks configured against CI (docs/DEPLOYMENT.md)
- [ ] Verified a deliberately broken commit fails to promote
- [ ] Final smoke test against the live production URL
