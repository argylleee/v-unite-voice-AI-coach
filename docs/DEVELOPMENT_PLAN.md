# Development Plan

With 2-3 days available, build in this order. Each phase should be working and verified (tests +
lint + typecheck + build green) before the next starts — don't let phases blur together, and
don't start the frontend first. Update `STATUS.md` as phases genuinely complete.

## Phase 1 — Foundation
GitHub repo -> Next.js + TypeScript + Tailwind + ESLint + test runner -> Supabase project ->
apply `supabase/migrations/` -> seed script producing 100 patterned customer records (see
`docs/DATABASE.md`). No AI, no n8n yet. Prove the foundation runs, lints, type-checks, and builds.

## Phase 2 — n8n plumbing (prove the wire before adding intelligence)
Next.js -> n8n webhook (bearer-secret protected) -> Supabase -> response, with no LLM involved
yet. Confirms the architecture's actual request path works before layering AI on top of it.

## Phase 3 — Structured AI agent
Add the LLM, `customer_analytics`, `customer_lookup`, `kpi_calculator` as n8n tool sub-workflows
behind the `AI Agent` node (`docs/N8N.md`). Verify: "Which treatment needs attention?", "Which
customers need follow-up?", "Where are rebooking rates weak?"

## Phase 4 — RAG
PDF/TXT upload -> chunk -> embed -> pgvector (`docs/RAG.md`, `docs/DATABASE.md`) ->
`knowledge_search` tool. Verify: "What does our SOP say?"

## Phase 5 — Hybrid reasoning (the most important phase)
Verify the SQL+RAG combination works and produces specific coaching, not a data dump: "Why is
CoolSculpting conversion low, and what does our SOP recommend?" This is the demo's "money shot" —
don't move on until it's genuinely good, not just functional.

## Phase 6 — Voice
Fish Audio STT -> existing agent pipeline -> Fish Audio TTS (`docs/VOICE.md`). Confirm the
`MediaRecorder` output format is actually accepted by Fish Audio's STT endpoint with a real
recorded clip before considering this phase done — this is the one integration point in the whole
plan most likely to have a format-mismatch surprise.

## Phase 7 — Sessions
Save sessions/messages, end-session summary + action plan generation and persistence
(`docs/AI_AGENT.md`, `docs/DATABASE.md`).

## Phase 8 — UI, via Impeccable
Only now invest in UI. Run `/impeccable init`, then build/`shape`/`critique`/`audit`/`polish` each
required screen per `docs/UI_DESIGN.md`. Loading/error/voice states, evidence and source display,
suggested-question categories, responsive layout, accessibility basics.

## Phase 9 — QA pass
Full test suite: unit, integration, e2e/smoke, failure/regression (`docs/TESTING.md`). CI green.

## Phase 10 — Deployment
Deploy to Vercel, set all environment variables (`.env.example`), configure Vercel Deployment
Checks against the CI workflow (`docs/DEPLOYMENT.md`) — verify a deliberately broken commit
actually fails to promote before trusting the gate on demo day. Final smoke test against the live
URL.

## Before submitting

Run the full requirement list in `docs/PROJECT_SPEC.md` as a literal checklist against the live
deployment, not the local dev server. Update `STATUS.md`. Rehearse the primary demo scenario
end to end at least once against production.
