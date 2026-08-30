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

### Phase 2 notes — built, pending live wiring
- **n8n workflow "WF-01 Chat Coach"** created (id `asM0e5EkCsFc2pyx`, instance
  `https://aldreisantua-n8n.duckdns.org`). No LLM yet: `POST /webhook/coach` (header-auth)
  → Normalize → Validate (UUID clinicId + non-empty message) → Postgres per-treatment
  metrics query on Supabase → Build Response → Respond. Explicit 400 (invalid) and 502
  (DB error) branches.
- **Next.js**: `POST /api/coach` route (`src/app/api/coach/route.ts`) — Zod-validates the
  body (`src/lib/validation/chat.ts`), forwards server-side to the n8n webhook with
  `Authorization: Bearer $N8N_WEBHOOK_SECRET` (`src/lib/n8n/client.ts`), maps failures to
  400/500/502. 6 integration tests (`tests/integration/coach-route.test.ts`), n8n call mocked.
- **Blocked on manual n8n setup** (secrets can't be created via API):
  1. Create HTTP Header Auth credential "V-Unite n8n Webhook Secret" (Name `Authorization`,
     Value `Bearer <secret>`), attach to the Chat Webhook node.
  2. Create Postgres credential "V-Unite Supabase" (session pooler host, 5432, db `postgres`,
     user `postgres.hhwkiimgjvdierjbjuxg`, password, SSL on), attach to Query Clinic Metrics.
  3. Activate the workflow.
  4. Put the same secret + `N8N_CHAT_WEBHOOK_URL=https://aldreisantua-n8n.duckdns.org/webhook/coach`
     in `.env.local` (and later Vercel).

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
