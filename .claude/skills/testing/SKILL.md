---
name: testing
description: Use when writing tests, setting up CI, or diagnosing a failing check.
---

# Testing

Read `docs/TESTING.md` and `docs/DEPLOYMENT.md` first.

## Rules

- Protect the highest-risk behavior; don't chase test count.
- Unit tests (`tests/unit/`) for deterministic business logic only (conversion rate, rebooking
  rate, average spend, follow-up filtering, segmentation).
- At least one integration test (`tests/integration/`) covering a real request -> orchestration
  -> database path. Mock paid external APIs (LLM, Fish Audio) — allowed and expected.
- At least one e2e/smoke test (`tests/e2e/`) covering the core journey: open app -> create
  session -> ask a coaching question -> receive response -> end session -> verify summary.
- At least one failure/regression test — the required one is a clinic-policy question with no
  matching uploaded document, expecting an explicit "not enough information" answer, never a
  fabricated one.
- Never assert exact-string equality on LLM output. Assert structure, evidence presence, correct
  tool selection, and expected business facts instead.
- When a real bug is found, add a regression test for it where practical.
- CI (`.github/workflows/ci.yml`) must fail the check on lint, typecheck, unit, integration, or
  build failure. This is also what Vercel Deployment Checks gate on — see `docs/DEPLOYMENT.md`.
