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
(data) + DeepSeek (reasoning, inside n8n) + Cohere embeddings + Fish Audio TTS + Groq Whisper STT.
Deployed on Vercel. See `docs/ARCHITECTURE.md`.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the **"Required by the deployed app"** block
   (Supabase URL + service-role key, the four `N8N_*_WEBHOOK_URL`s, `N8N_WEBHOOK_SECRET`). The
   model, embeddings and voice services are configured inside n8n, not here — see the notes in
   `.env.example`. `npm run db:migrate` additionally needs `SUPABASE_DB_URL`.
3. Apply migrations: `npm run db:migrate` (runs every file in `supabase/migrations/` in order
   against `SUPABASE_DB_URL`), or paste them into the Supabase SQL editor.
4. `npm run seed` — populates one clinic and 100 deterministic demo customers (`docs/DATABASE.md`).
5. `npm run dev`

Checks: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`. E2E:
`npm run build && npm run test:e2e` (first run: `npx playwright install chromium`).

## Testing

`npm run test:unit`, `npm run test:integration`, `npm run test:e2e` — see `docs/TESTING.md`.
CI (`.github/workflows/ci.yml`) fails on lint / typecheck / unit / integration / build;
`.github/workflows/e2e.yml` runs the Playwright core-journey smoke.

## Using AI to test, diagnose and fix — not just to build

Every non-trivial bug in this build followed the same loop: pin the expected behaviour, get it
under a test or an inspectable execution, find the root cause, fix that, and lock it with a
regression check. The commit history shows this; the notable ones:

| Symptom | Root cause | Fix + lock |
|---|---|---|
| `/api/coach` occasionally returned **two** HTTP responses for one request | `alwaysOutputData` on WF-01's metrics query fired the success **and** DB-error branches | Single-row aggregate query, removed `alwaysOutputData`; verified against the n8n execution view |
| Agent answers failed schema validation ~1 run in 4 (fenced JSON, prose around it, whole object nested inside `answer` as a string, `kpi_calculator` looping to the iteration cap → 502) | Trusting the LLM to emit clean JSON | WF-01 now returns raw text; `src/lib/validation/agent-response.ts` strips fences / extracts / unwraps, Zod-validates, retries once, then a safe `degraded` fallback. Locked by 11 unit tests + `tests/integration/grounding.test.ts` |
| Voice replies came back as **6 bytes** of audio | Instance runs `binaryDataMode: "database"`, so inline `binary.data.data` in a Code node is empty | `await this.helpers.getBinaryDataBuffer(0, 'data')` in WF-02's encode step |
| Groq model calls 400 `Bad request` | `llama3-8b-8192` is a decommissioned model id | Pinned `llama-3.3-70b-versatile`; later moved the whole reasoning path to DeepSeek |
| `.env.example` vanished in a commit | a broad `git add -A` staged an accidental deletion | Caught in the staged-diff review, restored from `git show <sha>^:.env.example`, added `.gitattributes` + gitignore rules for the scratch files that caused it |
| The e2e "smoke" test asserted a heading that no longer exists | It was a Phase-1 stub, never wired into the CI gate, so nothing caught the drift | Rewrote it as the real core journey with `page.route()` stubs; added `e2e.yml` |
| The `grounding` regression test | required failure case: a policy question with no matching document | `tests/integration/grounding.test.ts` — asserts the refusal is relayed verbatim, `evidence` stays empty, `degraded` is falsy |

## Known deviation: voice speech-to-text

`docs/PROJECT_SPEC.md` names Fish Audio for voice input and output. Fish Audio's `/v1/asr`
(speech-to-text) endpoint has **no free tier** — it returns `402 Insufficient API credit` on
every model, and the $1 AI budget is for the LLM. So **STT uses Groq Whisper**
(`whisper-large-v3-turbo`, free, natively accepts the browser's webm/opus) while **Fish Audio
still does the TTS** (voice output, free model `s2.1-pro-free`). WF-02's STT step is a single
HTTP Request node — swapping it back to Fish `/v1/asr` is a one-node change if API credit is
provided. This was flagged to Emman.

## Deployment

CI owns the deploy: `.github/workflows/ci.yml` has a `deploy` job that runs `vercel deploy --prod`
only on a push to `main` and only after `quality` + `e2e` pass (`needs: [quality, e2e]`).
`vercel.json` disables Vercel's own auto-deploy for `main`, so a red check means production stays
on the last good build — requirement #16, enforced. Full setup (Vercel project, env vars, the
three GitHub secrets, and how to prove the gate) is in `docs/DEPLOYMENT.md`.
