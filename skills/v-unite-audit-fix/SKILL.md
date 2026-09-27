---
name: v-unite-audit-fix
description: Diagnose and repair the V-Unite Voice AI Coach repository's verified security and reliability gaps. Use when fixing this project's API access, session lifecycle, seed/setup, n8n workflows, ingestion, or CI checks; not for unrelated repositories.
---

# V-Unite audit and repair

This skill is a handoff for a fixing agent. Work in the V-Unite Voice AI Coach repository. Read `CLAUDE.md`, relevant `docs/`, and current `AGENTS.md` files before changing code. Preserve the existing architecture: Next.js API and UI, n8n orchestration, Supabase data. Preserve all pre-existing worktree changes, especially the deleted lowercase and added title-case workflow exports; determine which exports are authoritative before editing them. Do not touch the live database, n8n instance, Vercel project, or production site without separate authorization. Never put credentials or customer data in logs or artifacts.

## Audit snapshot (2026-09-27)

This is a bounded source and local-check audit, not a claim that every live-system fault or vulnerability has been found. `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, and `npm run test:e2e` passed; Vitest ran 88 tests in 9 files and Playwright ran 2 smoke tests. `npm audit --json` reported **0 known dependency advisories** for the current lockfile. Initial test/build attempts inside the restricted process sandbox failed with `spawn EPERM`; checks passed when process spawning was allowed. Existing tests mock n8n and Supabase; they do not prove live workflow behavior. On 2026-09-27, the deployed site at `https://v-unite-voice-ai-coach.vercel.app/` was also inspected: the Coach, Knowledge, and Sessions pages loaded; a live Coach API call failed as recorded below. Re-run checks after changes.

The following findings are supported by code or workflow exports. Severity assumes a publicly reachable deployment with real clinic data; the repository describes its no-auth setup as an MVP choice. Verify deployment exposure before assigning operational severity.

## Findings and required repairs

### P0 — Deployed coach currently fails with upstream HTTP 502

**Observed production behavior (2026-09-27):** A POST to `https://v-unite-voice-ai-coach.vercel.app/api/coach` with the public demo clinic UUID, `mode: "chat"`, and the ordinary question `Which treatment needs attention?` returned HTTP **502** twice. The response body was `{"ok":false,"error":"upstream_error","upstreamStatus":502}`. This reproduction omitted `sessionId`, so it did not create or append to a coaching session. The Knowledge page listed ready documents and the Sessions page listed prior sessions, so the whole site was not down. Do not assume the failing n8n node from this response alone.

**Additional observed diagnostic:** One explicitly authorized direct POST to the configured Railway `/webhook/coach` with the demo UUID and a generic question returned HTTP **502** with `{"ok":false,"error":"agent_error"}`. It reached WF-01 and took its agent-error branch; the first failing internal node is not yet known.

**Diagnostic path:** Correlate the request time with Vercel `/api/coach` logs and the active n8n WF-01 execution. Inspect the first failing n8n node, its status and sanitized error, then verify the live WF-01 activation, webhook credential, AI model credential, SQL tool credentials, `knowledge_search` sub-workflow ID, and database availability as applicable. Compare the active n8n workflow with the exported JSON; the current worktree has replacement exports that may differ from the deployed instance. `src/lib/n8n/client.ts` parses the upstream response and `src/app/api/coach/route.ts` returns only `upstreamStatus`, so the public response intentionally lacks the n8n failure detail. Avoid recording secrets or customer rows in diagnostic artifacts.

**Repair and acceptance:** Fix the failing live dependency/workflow or its configuration, then make a single non-sensitive production request and require HTTP 200 with a schema-valid, grounded answer. Add an isolated integration check against an imported WF-01 or a safe staging n8n instance; existing mocked tests cannot catch this failure. Do not redeploy or edit the live n8n instance without authorization.

### P0 — Public API exposes service-role-backed clinic data and costly actions

**Evidence:** `src/lib/supabase/admin.ts` creates a service-role client. `src/app/api/sessions/route.ts`, `src/app/api/sessions/[id]/route.ts`, `src/app/api/sessions/[id]/end/route.ts`, and `src/app/api/knowledge/route.ts` have no caller authentication. `src/app/api/coach/route.ts` and `src/app/api/voice/route.ts` accept public requests and call paid/provider-backed workflows. `src/lib/client/api.ts` exposes a default clinic UUID in browser code. Supabase RLS in `supabase/migrations/0003_rls.sql` cannot protect calls made with the service-role key. On the live site, `/sessions` listed prior conversations and an individual transcript opened without sign-in; `/knowledge` listed ready document names without sign-in. This confirms exposure, although the data's sensitivity depends on what the clinic has stored.

**Repair:** Define who may use the demo before changing routes. For a private deployment, require server-verified identity or an access gate on every `/api/*` endpoint and derive the allowed clinic from that identity. A browser-supplied `clinicId` is a selector, not proof of access. Keep service-role credentials server-side. Apply route or edge-level request and cost limits to chat, voice, upload, and summary operations. If intentionally public demo access is required, isolate it to synthetic data and a tightly limited budget. Add tests proving unauthenticated and unauthorized requests cannot read, write, or invoke paid work.

### P0 — Session IDs allow cross-clinic reads and writes

**Evidence:** `getSessionWithMessages`, `recordTurn`, `getTranscript`, and `finalizeSession` in `src/lib/db/sessions.ts` filter only by `session_id` or `id`. The corresponding routes accept any valid UUID. `/api/coach` accepts independent `clinicId` and `sessionId`; it can generate for one clinic then append to a session of another. `/api/sessions/[id]/end` can summarize and replace an arbitrary session's action plans.

**Repair:** After the caller gate is established, scope every session query and mutation to the authorized clinic, including message inserts and summary writes. Verify ownership before calling n8n. Enforce a database-level relationship for each message and consider a transaction/RPC for multi-row writes. Respond with the same non-disclosing 404 behavior for missing and inaccessible IDs. Add two-clinic tests covering detail, coach turn, voice turn, transcript, and end-session paths.

### P1 — Fresh seed does not establish the browser's clinic ID

**Evidence:** `src/scripts/seed.ts` inserts a clinic without an explicit ID and logs the generated UUID. `src/lib/client/api.ts` and `.env.example` default `NEXT_PUBLIC_CLINIC_ID` to `80a1c835-ed66-4c0c-8c3c-52c5e90fdbf4`. On a fresh database those IDs need not match, so the UI can query an empty/nonexistent clinic.

**Repair:** Use one deliberate setup contract: seed the configured demo clinic ID, or require setup to capture the seeded ID and configure `NEXT_PUBLIC_CLINIC_ID` before build/deploy. Remove any silent fallback that masks a mismatch. Add a fresh-database or isolated seed test verifying the configured UI clinic exists and owns the generated customers. Do not run the current seed against valuable data: it deletes all customers for the same clinic name before reinserting them.

### P1 — Voice turns are not saved to the session

**Evidence:** `src/app/api/voice/route.ts` forwards `sessionId` to WF-02 but never calls `recordTurn`. The exported `n8n/workflows/WF-02 Voice Coach.json` builds the WF-01 HTTP body from `clinicId`, transcript, and `mode`, omitting `sessionId`. WF-01 therefore cannot persist a voice turn either. An ended voice-only session has an empty transcript in `getTranscript` and returns `empty_session`.

**Repair:** Persist the validated transcript and answer exactly once after a successful voice response, with the authorized session/clinic association. Choose one owner for persistence (prefer the API boundary) and prevent duplicate writes if a retry occurs. Test a voice-only session through end-session summarization and verify both message roles and `input_mode: voice`.

### P1 — Voice timeout exceeds the route runtime limit

**Evidence:** `src/app/api/voice/route.ts` exports `maxDuration = 60` while its n8n fetch uses `AbortSignal.timeout(90_000)`. The request can be terminated by the host before the application's timeout/error handling runs.

**Repair:** Set the upstream deadline below the actual hosting limit with room for upload, JSON parsing, and response serialization, or move long-running voice work to a durable async job with polling. Verify the limit in the target hosting plan and test timeout handling. Do not merely raise a number beyond the platform limit.

### P1 — Knowledge ingestion can leave requests without a controlled failure response

**Evidence:** In the exported `n8n/workflows/WF-03 Knowledge Ingestion.json`, `Extract PDF`, `Extract Text`, `Split Into Chunks`, `Insert Document Row`, `Attach Embeddings`, and `Mark Document Ready` flow only through success outputs. Only Cohere embedding and chunk insertion have explicit error outputs into `Mark Document Failed`. The Next.js route waits up to 60 seconds for WF-03 and then labels every successful upstream response as HTTP 202, regardless of whether the workflow says `ready`.

**Repair:** Handle extraction, empty/oversized extracted text, document insert, embedding-shape errors, chunk insert, and ready-status update explicitly in the workflow. Ensure one response per execution and a terminal `failed` state for any document row already created. Decide whether ingestion is synchronous (`200`, ready) or asynchronous (`202`, processing), and make route/UI semantics match. Test corrupt PDF, empty text, embedding failure, insert failure, and timeout in an isolated n8n/database environment.

### P2 — Upload validation trusts extension and MIME metadata

**Evidence:** `validateUploadFile` in `src/lib/validation/knowledge.ts` checks filename extension, reported MIME, and byte size; it does not inspect content. The route calls `request.formData()` before checking file size. Audio validation similarly trusts MIME and byte count. The document-count check in `src/app/api/knowledge/route.ts` is a read followed by a separate ingestion write, so concurrent uploads can exceed 25.

**Repair:** Enforce request-body limits before full multipart buffering at the hosting/proxy boundary, verify PDF signature or decodable text content, cap extracted text/chunks and provider input, and make the per-clinic document quota atomic in the database or a serialized job. Reject ambiguous or malformed files with a controlled error. Test content spoofing and concurrent quota attempts. Keep file parsing inside the n8n ingestion layer as the project architecture requires.

### P2 — Retrieval may use the demo clinic when its input is missing

**Evidence:** `n8n/workflows/knowledge_search.json` supplies a hardcoded demo clinic UUID when `Tool Input.clinicId` is absent. The SQL function is clinic-filtered, but a malformed internal call can still read the wrong clinic's passages. The query also does not require `knowledge_documents.status = 'ready'`.

**Repair:** Require and validate the clinic ID at the sub-workflow boundary; fail closed on absence or malformed input. Remove the fallback. Join documents with the same clinic ID and filter ready documents. Add a two-clinic retrieval check and a missing-ID check in an isolated workflow execution.

### P2 — Session finalization is non-atomic and repeatable

**Evidence:** `finalizeSession` in `src/lib/db/sessions.ts` updates the session, deletes its `action_plans`, then inserts replacements as separate API calls. A failed insert leaves partial state. Repeated POST `/api/sessions/[id]/end` invokes the model again and replaces the plan.

**Repair:** Use one transactional database function or equivalent transaction for session and action-plan changes. Define idempotent end behavior; repeated requests should return the stored summary or use an explicit regeneration path. Verify rollback on failure and a repeated request does not duplicate provider cost or erase plan state.

### P2 — CI quality gate has an unpinned executable

**Evidence:** `.github/workflows/ci.yml` runs `npx impeccable detect --json src/`, but `impeccable` is absent from `package.json` and `package-lock.json`. CI behavior can change as npm resolves a new tool version or fail on install/network access.

**Repair:** Pin the exact tool/version as a dev dependency or invoke a repository-pinned action/artifact. Verify the command's exit status on a clean `npm ci` checkout. Keep the existing deploy dependency on quality and e2e checks.

## Execution order and acceptance

## Current local repair state (2026-09-27)

The source tree now contains local fixes for demo-clinic enforcement, visitor-scoped sessions and
uploads, database-backed rate limits, deterministic seed ID, voice persistence, shorter upstream
timeouts, fail-closed retrieval, a transactional session-finalization RPC, n8n ingestion error
branches, file-content checks, and pinned CI tooling. Migration `0005_public_demo_guardrails.sql`
and the exported n8n workflow changes are **not applied to live services** merely by being present
in the repo. Existing knowledge documents remain hidden until an operator sets `demo_curated=true`
after verifying that each one is synthetic. The live coach still returned `agent_error` in the only
authorized direct diagnostic; identify the first failing node in the active n8n execution before
claiming it is fixed. The owner is moving n8n from inaccessible Railway to their DuckDNS instance;
follow `n8n/SELF_HOSTED_CUTOVER.md`, `n8n/HOST_STABILITY.md`, and `docs/DEPLOYMENT.md` for coordinated rollout. Verify every claim
against the deployed result. The findings above remain the regression checklist for the harness.

1. Snapshot Git status and reconcile the in-progress n8n filename replacements without deleting user work. Confirm which workflow files the live n8n instance actually uses; exports alone do not prove deployment state.
2. Triage the live Coach 502 using sanitized Vercel and n8n execution logs. Fix and verify it in a safe environment before any authorized live workflow change.
3. Fix access control and clinic/session ownership. Preserve the single-clinic demo UX if required, but make access explicit and server-verified. Add negative tests for unauthorized routes and cross-clinic IDs.
4. Make fresh setup deterministic, then repair voice persistence and the timeout contract.
5. Repair WF-03's failure paths and retrieval input validation in exported JSON; validate imports and execution in a safe n8n environment before any live replacement.
6. Address upload/resource limits, transactionality, and CI reproducibility. Prefer narrow changes over a broader rewrite.
7. Re-run `npm audit --json`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, and the Playwright smoke suite. Tests need an environment permitting child-process spawn; `spawn EPERM` before test startup is an environment failure. Verify live-provider paths separately only with authorized credentials and non-sensitive test data.
8. Review the final diff for secrets, generated files, accidental workflow renames, and unrelated changes. Report each finding as fixed, unverified, or deferred with concrete evidence. Do not claim the project is vulnerability-free.
