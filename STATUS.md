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
- [x] Embedding model chosen: Cohere `embed-english-v3.0` (1024 dims). Migration `0004`
      applied — `knowledge_chunks.embedding` is `vector(1024)`, HNSW index +
      `match_knowledge_chunks` recreated. `.env.example` updated (also restored — see note).
- [x] Next.js: `POST /api/knowledge` (multipart upload → PDF/TXT + 4 MB + 25-doc/clinic
      validation → forward file to n8n with bearer) and `GET /api/knowledge?clinicId=` (list
      + `chunk_count` + status). 13 integration tests. (`src/lib/validation/knowledge.ts`)
- [x] n8n build guide: `n8n/PHASE_4_BUILD.md` — WF-03 ingestion + TOOL-knowledge_search,
      exact node config, Cohere `/v2/embed` calls, SQL, verify + grounding checklist.
- [x] n8n workflows built (WF-03 ingestion, TOOL-knowledge_search) + `knowledge_search` wired
      onto WF-01's agent, SQL-vs-RAG + grounding system message, output-parser example.
- [x] **Migrated to V-Unite's Railway instance** (`primary-production-c0ce.up.railway.app`),
      LLM swapped Groq -> **DeepSeek** (`lmChatOpenAi` + `deepseek-chat`, base URL on the
      `DeepSeek` credential). Live IDs: WF-01 `jqhA2QoRzHkrarno`, WF-03 `ZPJQHNi1EJrkdWGF`,
      TOOL `WUu7dGYIp3THhDw4` — all active. `n8n/workflows/*.json` re-snapshotted from the
      live instance; `n8n/MIGRATION.md` documents the pitfalls hit.
- [x] WF-03 ingestion verified end to end: `POST /webhook/knowledge` with a TXT SOP ->
      `{ok:true, chunks:1, status:"ready"}`; Supabase has the chunk with a 1024-dim embedding.
      (WF-03 rework needed: extraction must precede the Postgres insert — it drops binary;
      `Insert Chunks` uses the Postgres *insert* op, not comma-split query params.)
- [x] `knowledge_search` retrieval works: "What does our SOP say about cancellations?" ->
      quotes the policy from `Consultation SOP.txt`. `match_threshold` lowered 0.5 -> 0.3 for
      this small corpus.
- [x] Grounding (required failure test): "What is our refund/returns policy?" -> refuses,
      no fabrication.
- [x] Full app path verified: `/api/coach` -> Railway WF-01 -> DeepSeek + 4 tools ->
      Supabase, all 3 coaching questions + SOP + grounding clean, no `degraded`.
- [x] DeepSeek emits inconsistent JSON, so WF-01 now returns the model's **raw text**
      (`{ agent_output }`); `src/lib/validation/agent-response.ts` `parseAgentResponse()`
      strips fences / surrounding prose / nested-`answer` wrapping, then Zod-validates
      (retry once, then `degraded` fallback). 11 unit + 12 integration tests.

### Phase 4 notes
- PDF ingestion path (`Extract PDF`) is wired the same as TXT but not yet tested with a
  real PDF file.
- WF-03 `Cohere Embed` uses a Header Auth cred (`Cohere Header`); TOOL `Embed Query` uses the
  predefined `cohereApi` cred (`Cohere account`) — both work on n8n 2.35.3, left as-is.
- Retrieval quality on a 1-doc / 1-chunk corpus is marginal; revisit chunk size + threshold
  in Phase 5 when there are more documents.

## Phase 5 — Hybrid reasoning
- [x] SQL + RAG combined question produces specific, evidence-based coaching. Verified on
      Railway: the money-shot "Based on our CoolSculpting conversion data and our consultation
      SOP, what should we change?" returns hybrid answers 6/6 — calls `customer_analytics`
      (+`customer_lookup`) AND `knowledge_search`, `evidence[]` carries both `customer_data`
      and `knowledge_base` entries, recommendations are anchored to SOP section numbers
      (3.2 / 4.2 / 4.4 / 8), not a data dump. Grounding still holds (refuses on absent docs).

### Phase 5 notes
- Uploaded a realistic "Consultation and Conversion SOP.txt" (3 chunks) to give the hybrid
  question real material — the earlier 1-chunk test doc was too thin.
- Tuning applied to WF-01's AI Coach Agent:
  - system message rewritten to plain ASCII (API round-trips had mangled the em-dashes into
    mojibake, which DeepSeek then echoed) + a hard rule that `evidence[]` must be populated
    whenever a tool was called.
  - `kpi_calculator` de-emphasised (customer_analytics already returns computed rates) +
    "call each tool at most once or twice, never repeat" — DeepSeek had been looping on
    `kpi_calculator` 6x and hitting the iteration cap (~25% of runs failed with 502).
  - `maxIterations` 4 -> 8; `/api/coach` timeout 45s -> 60s for slow multi-tool turns.
- Occasional 502 under load is a free-tier Railway latency issue, not a logic failure — it
  fails cleanly (no hang, no fabrication).

## Phase 6 — Voice
- [x] Next.js: `POST /api/voice` — multipart audio upload, format/size validation
      (`src/lib/validation/voice.ts`: webm/ogg/mp4/wav/mp3/flac/aac, ≤8 MB), forwards to the
      WF-02 webhook with bearer, validates `{ transcript, answer, audio_base64, audio_mime }`
      back, distinct 400/500/502 paths. `n8nVoiceConfig()` helper. 8 integration + 6 unit tests.
- [x] Fish Audio contract confirmed from `api.fish.audio/openapi.json`: STT `POST /v1/asr`
      (multipart `audio`), TTS `POST /v1/tts` (JSON, raw audio bytes). `n8n/PHASE_6_VOICE.md`
      has the WF-02 flow + the MediaRecorder-format test plan.
- [x] Fish Audio key wired: n8n credential "Fish Audio" (`lOgLZPUqsI2fdh93`, header-auth) +
      `.env.local`. TTS verified live (`POST /v1/tts`, `model: s2.1-pro-free`,
      `reference_id 9a9cf477...`, `format mp3` -> valid 128kbps mp3).
- [x] **WF-02 Voice Coach built + active** (`vqq63jCqbWA4k7wP`): Voice Webhook -> Fish STT
      (`/v1/asr`) -> Prep -> Call WF-01 (`/webhook/coach`, mode:voice) -> Parse Answer ->
      Fish TTS -> Encode (base64) -> Respond `{transcript, answer, audio_base64, audio_mime}`.
      Every stage has an error branch -> Respond 502 `voice_pipeline_failed`. Wiring + error
      path verified with a real audio POST. `n8n/workflows/wf-02-voice-coach.json` snapshot.
- [x] **STT: Groq Whisper (`whisper-large-v3-turbo`), not Fish** — Fish `/v1/asr` has no free
      tier (402 on every model, $0 API credit). Groq's free tier does Whisper, natively
      accepts webm/opus, and is fast. Fish still does the voice *output* (TTS). Deviation from
      `PROJECT_SPEC` "Fish for voice input" — flag to Emman; one-node swap back if Fish credit
      appears. `Groq account` credential created on Railway.
- [x] **STT -> agent -> TTS verified end to end** at $0: `POST /webhook/voice` and
      `POST /api/voice` both return `{ transcript, answer, audio_base64 (~400 KB valid mp3),
      audio_mime }` in ~18-19s. (`Encode Response` uses `getBinaryDataBuffer` — the instance's
      binaryDataMode is `database` so inline binary access returns empty.)
- [ ] MediaRecorder webm/opus from a real browser recording (Groq docs list webm as supported;
      the actual browser test happens with the Phase 8 recorder UI).
- [ ] Required voice UI states (`idle/recording/uploading/transcribing/thinking/speaking/error`)
      — Phase 8 Impeccable pass.

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
