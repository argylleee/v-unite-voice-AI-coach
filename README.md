# V-Unite Voice AI Coach

AI business coach for aesthetic clinic owners — chat and voice, backed by structured clinic/
customer data and an uploaded clinic knowledge base. Built for the V-Unite MVP applicant
challenge.

## Start here

- `CLAUDE.md` — project constitution; read this and the linked `docs/` files before writing code.
- `docs/PROJECT_SPEC.md` — the literal challenge requirements and rubric.
- `docs/DEVELOPMENT_PLAN.md` — the phase-by-phase build order.
- `STATUS.md` — live progress checklist.

## Stack

Next.js + TypeScript (presentation) -> n8n (AI orchestration) -> Supabase/PostgreSQL + pgvector
(data) + an LLM (reasoning) + Fish Audio (voice). Deployed on Vercel. See `docs/ARCHITECTURE.md`.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in Supabase, n8n, Fish Audio, and LLM credentials.
   Phase 1 only needs `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
   `SUPABASE_DB_URL`.
3. Apply migrations: `npm run db:migrate` (runs every file in `supabase/migrations/` in order
   against `SUPABASE_DB_URL`), or paste them into the Supabase SQL editor.
4. `npm run seed` — populates one clinic and 100 deterministic demo customers (`docs/DATABASE.md`).
5. `npm run dev`

Checks: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`. E2E:
`npm run build && npm run test:e2e` (first run: `npx playwright install chromium`).

## Testing

`npm run test:unit`, `npm run test:integration`, `npm run test:e2e` — see `docs/TESTING.md`.

## Deployment

See `docs/DEPLOYMENT.md` — deployment gating via Vercel Deployment Checks needs a one-time
dashboard configuration, not just a CI YAML file.
