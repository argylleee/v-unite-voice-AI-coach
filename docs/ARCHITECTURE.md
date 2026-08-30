# Architecture

## System layers

1. **Presentation** — Next.js (App Router) + TypeScript + React + Tailwind.
2. **Orchestration** — n8n. This is the AI backend, not a peripheral automation tool.
3. **Data** — Supabase / PostgreSQL, structured tables.
4. **Vector** — Supabase pgvector, unstructured clinic knowledge only.
5. **AI** — an LLM reached only from inside n8n, never directly from Next.js.
6. **Voice** — Fish Audio, reached only from inside n8n.

```
Browser (Next.js)
   |  fetch, server-side only, bearer-secret webhook call
   v
n8n Webhook  ->  validate  ->  load session  ->  AI Agent node
                                                     |
                          +--------------------------+--------------------------+
                          |                          |                          |
                 Call n8n Workflow Tool     Call n8n Workflow Tool     Call n8n Workflow Tool
                 customer_analytics          knowledge_search           kpi_calculator
                          |                          |                          |
                     Supabase (SQL)             Supabase pgvector          in-workflow code
                                                (match_documents RPC)
                          +--------------------------+--------------------------+
                                                     |
                                            LLM reasoning (agent)
                                                     |
                                        save messages -> Supabase
                                                     |
                                            response JSON -> Next.js -> Browser
```

Voice reuses this exact pipeline; it only adds Fish Audio STT before the webhook call and Fish
Audio TTS after the response, inside the same n8n workflow family. There is no separate voice
reasoning system — see `docs/VOICE.md`.

## Layer responsibilities

**Next.js** — UI, chat input, voice recording (`MediaRecorder`), audio playback, file upload UI,
session history display, loading/error states. Must not decide which tool to call or talk to the
LLM directly. May read Supabase for simple, non-sensitive display data (e.g. session list) only
through a Next.js **server-side** route handler using the service-role key — never a client
component, never the anon key exposed to the browser. See `docs/SECURITY.md`.

**n8n** — receives requests, validates them, loads session context, runs the AI Agent, executes
tools, performs RAG retrieval, calls the LLM, calls Fish Audio, persists conversations, handles
errors. Everything that decides *what the coach does* lives here. See `docs/N8N.md` for the
concrete node types (n8n ships a native `AI Agent` / `Tools Agent` node plus a `Call n8n Workflow
Tool` node for wiring sub-workflows in as callable tools — use those, don't hand-roll agent
orchestration with generic HTTP/IF nodes).

**Supabase** — source of truth for `clinics`, `customers`, `knowledge_documents`,
`knowledge_chunks`, `coaching_sessions`, `messages`, `action_plans`. pgvector lives in the same
Postgres instance and is used only for `knowledge_chunks.embedding`. See `docs/DATABASE.md`.

**LLM** — intent understanding, tool selection, evidence interpretation, business reasoning,
coaching language, summarization. Never the source of truth for a structured metric; never called
directly from the browser or from Next.js.

**Fish Audio** — STT and TTS only, called from n8n. See `docs/VOICE.md` for the actual API
contract (base URL, auth header, endpoints, format constraints).

## Tool selection

| Question type | Route |
|---|---|
| Structured business question | SQL tool (`customer_analytics`, `customer_lookup`, `kpi_calculator`) |
| Clinic knowledge question | RAG tool (`knowledge_search`) |
| Both | SQL + RAG, synthesized by the LLM |
| "What did we discuss last time?" | `session_context` |

Never use vector search for a deterministic database question. Never let the LLM compute a metric
that a SQL query or a small function can compute exactly.

## Decisions (evaluated against the brief and rubric ahead of time — don't relitigate mid-build)

### 1. Optional coding/agent harness behind n8n: explicitly not used

The brief allows extending n8n workflows with a self-hosted coding/agent harness (example given:
Claude Code CLI in non-interactive mode) that n8n calls for reasoning, code execution, or
analysis, with n8n remaining the orchestrator. This project does not build one.

**Why:** the 18% Agent Architecture & Reasoning score rewards dynamic tool use and sensible
reasoning flow — both are already delivered by the five-tool n8n agent design in
`docs/AI_AGENT.md`. A coding harness adds a second runtime, a second deployment target, and a new
class of failure (harness unreachable, harness output malformed) without a rubric line that
specifically rewards having one. On a 2–3 day clock, that trade isn't worth it. If core
requirements are done with meaningful time left over, this is the first optional item to consider
— not before.

### 2. Database access pattern: server-side only, Row Level Security default-deny

Supabase is never queried directly from client-side/browser code. n8n holds the service-role key
(server-side, in n8n credentials — never in a workflow node literal). Any read Next.js needs for
display (e.g. listing past sessions) goes through a Next.js **API route** (server-side execution)
using the service-role key, not a browser Supabase client with the anon key.

Every table has Row Level Security **enabled** with **no permissive policies** (see
`supabase/migrations/0003_rls.sql`). The service-role key bypasses RLS by design (that's how
n8n and the Next.js server routes read/write), so this costs nothing operationally, but it means a
leaked anon key or a future accidental client-side Supabase call exposes zero rows instead of the
entire customer database. This is a five-minute setup cost that removes an entire class of MVP
security bug, so there's no reason to skip it even under time pressure.

### 3. Model and embedding strategy: swappable, chosen against the $1 budget

`LLM_PROVIDER` / `LLM_MODEL` / `EMBEDDING_MODEL` are environment variables, never hardcoded. See
`docs/AI_AGENT.md` for the concrete model recommendation and the token-budget math — the $1 cap is
tight enough across a multi-day build-and-demo cycle that this needs a number, not just a
principle.

### 4. Deployment gating: Vercel Deployment Checks, configured explicitly

Requirement #16 ("a deployment/build should fail when required checks fail") is not satisfied
just by having a green GitHub Actions badge — Vercel's default GitHub integration promotes a
production build to your production domain regardless of a separate, unrelated CI workflow's
result. The two systems don't talk to each other unless you wire them together. See
`docs/DEPLOYMENT.md` for the exact dashboard steps (Vercel **Deployment Checks**, sourced from
GitHub Actions check results, gates promotion to the production domain).

### 5. UI built through the Impeccable design skill, not ad hoc

See `docs/UI_DESIGN.md`. This is a scope decision as much as a design one: rather than iterating on
visual polish by eye (expensive, subjective, easy to over-invest in given UI is only 5% of the
rubric), Impeccable's `/impeccable init` → build → `/audit`/`/critique`/`/polish` loop gives a
fast, checklist-driven way to avoid generic "AI slop" output without burning disproportionate
time on it.

## Constraints (apply throughout)

Do not introduce microservices, Kubernetes, Kafka, Redis, a separate Python/Node backend service,
a custom authentication system, or a multi-tenant architecture unless a concrete requirement above
makes one necessary. None currently does. The architecture must stay simple enough to build,
demo, and *explain* within the challenge timeframe — the brief explicitly scores your ability to
explain your decisions.
