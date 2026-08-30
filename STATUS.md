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

## Phase 0 — Housekeeping
- [ ] Asked Emman: OK to build on self-hosted n8n and migrate before submission? (docs/N8N.md)

## Phase 2 — n8n plumbing
- [x] "WF-01 Chat Coach" skeleton built (webhook -> validate -> query -> respond, no LLM yet)
- [x] Header Auth + Postgres credentials wired to the workflow; workflow activated
- [x] Webhook auth working end to end (Next.js -> n8n -> Supabase -> response)

### Phase 2 notes — verified live
- **n8n workflow "WF-01 Chat Coach"** (id `asM0e5EkCsFc2pyx`, instance
  `https://aldreisantua-n8n.duckdns.org`, active). No LLM: `POST /webhook/coach` (header-auth)
  → Normalize → Validate (UUID clinicId + non-empty message) → single-row aggregate query on
  Supabase → Build Response → Respond. Explicit 400 (invalid input) and 502 (DB error) branches.
  Credentials: Header Auth `VE5YkVkmlyAhvZUK`, Postgres `A56iVK09BB1EFdbH` (SSL: ignore-issues,
  required for Supabase's pooler cert).
- **Next.js**: `POST /api/coach` (`src/app/api/coach/route.ts`) — Zod-validates the body
  (`src/lib/validation/chat.ts`), forwards server-side to the n8n webhook with
  `Authorization: Bearer $N8N_WEBHOOK_SECRET` (`src/lib/n8n/client.ts`), maps failures to
  400/500/502. 6 integration tests (`tests/integration/coach-route.test.ts`), n8n call mocked.
- **Live verification (2026-08-30)**:
  - `curl /api/coach` valid body → 200, real per-treatment metrics for the seeded clinic
    (customerCount 100; CoolSculpting 8/29 purchases vs Botox 22/28).
  - bad UUID / empty message → 400 with Zod field errors, n8n never called.
  - malformed JSON → 400. n8n prod URL with no bearer header → 403.
  - n8n executions 802 (success), 803 (invalid → 400 branch), 798 (DB error → 502 branch).
- **Migration to V-Unite n8n later**: re-create credentials + repoint webhook base URL; the
  workflow JSON itself is portable. Tracked under Phase 0.
- `.env.local` now has `N8N_CHAT_WEBHOOK_URL` + `N8N_WEBHOOK_SECRET` (also needed in Vercel).

## Phase 3 — Structured AI agent
- [x] Next.js: `AgentResponseSchema` + `/api/coach` validates the agent response, retries
      once on malformed JSON, safe `degraded` fallback, 45s upstream timeout. 9 integration
      tests. (`src/lib/validation/agent-response.ts`, `src/types/agent-response.ts`)
- [x] n8n build guide: `n8n/PHASE_3_BUILD.md`
- [x] n8n side (user-built on WF-01): AI Coach Agent + Groq Chat Model
      (`llama-3.3-70b-versatile`) + Structured Output Parser + tools: `Clinic-wide Metrics`
      (Postgres Tool, per-treatment aggregate), `customer_lookup` (Postgres Tool, lapsed
      filter), `kpi_calculator` (Code Tool). Published.
- [x] "Which treatment needs attention?" → CoolSculpting, 27.6% conversion, 3 evidence items
- [x] "Which customers need follow-up?" → customer_lookup @ ≥90 days, 38 lapsed, named rows
- [x] "Where are rebooking rates weak?" → HydraFacial 10% vs Botox 81.8%, exact ratios
      (n8n executions 815 / 818 / 820; also verified through `/api/coach`)

### Phase 3 notes
- Verified against the self-hosted n8n host, which is intermittently unavailable (Cloudflare
  502 / "database not ready" 503 from the origin, ~1–4 min cold turns). When it's up, all
  three questions round-trip correctly through `/api/coach`; when it hiccups the route fails
  fast with 502 `upstream_error` (correct behaviour). Latency should be a non-issue on
  V-Unite's instance — revisit for the 12% responsiveness line after migration.
- Lookup answers give approximate sub-counts (LLM over ~200 rows); exact per-treatment counts
  are in `customer_analytics`. Tighten the prompt in Phase 5 if needed.
- TODO: export WF-01 JSON to `n8n/workflows/wf-01-chat-coach.json` and commit (Phase 10
  migration artifact).

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
