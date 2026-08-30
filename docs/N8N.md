# n8n

n8n is the main AI backend and orchestration layer — an explicit challenge requirement (8% of the
rubric directly, and a prerequisite for the 18% agent-architecture and 17% end-to-end lines).

## Development instance & build ownership (decided 2026-08-30)

**Instance:** development happens on the self-hosted instance at
`https://aldreisantua-n8n.duckdns.org` (confirmed reachable via MCP). The brief says n8n access
"will be provided by Emman from V-Unite" — likely because the $1 LLM credit is meant to be
provisioned as a credential inside whatever instance he gives you, and/or so evaluators can open
your workflows directly. Given real progress already exists on the self-hosted instance, the plan
is **build here, migrate before submission**: finish the workflows here, then export each as JSON
(n8n: workflow menu → Download) and import into V-Unite's instance once access is granted,
re-pointing credentials and the webhook URLs Next.js calls. **Ask Emman explicitly whether this is
acceptable** (the brief invites exactly this kind of clarifying question) — don't assume it is,
confirm it early enough that a "no" doesn't cost you rework time on day 2 or 3.

**Build ownership:** you are building these workflows yourself, by hand, in the n8n editor. That's
deliberate — the rubric scores your ability to explain your architectural decisions live, and
hand-building the agent/tool wiring is what makes that explainable rather than something you're
reading off a printout. My role is advisory: I have read access to the instance via MCP
(`get_workflow_details`, `search_workflows`, `search_nodes`, `validate_workflow`, etc.) to check
your work, confirm node availability, and help diagnose a failing workflow — not to build or edit
workflows for you unless you explicitly ask me to make a specific change.

**Confirmed on the instance already** (checked via MCP, so this is real, not assumed):
- `@n8n/n8n-nodes-langchain.agent` (the `AI Agent` node) is available.
- `n8n-nodes-base.postgresTool` (**Postgres Tool**) is available and can attach **directly** to
  the Agent node as a callable tool — for a straightforward SQL read (e.g. `customer_lookup`, or
  the `match_knowledge_chunks` RPC call for `knowledge_search`), you don't need to wrap it in a
  `Call n8n Workflow Tool` sub-workflow; a Postgres Tool node with a parameterized query hung
  directly off the Agent is simpler and just as correct. Reserve `Call n8n Workflow Tool`
  sub-workflows for tools with real multi-step logic (`customer_analytics`'s aggregation,
  `kpi_calculator`).
- `@n8n/n8n-nodes-langchain.chatTrigger` (n8n's own hosted/embeddable chat widget trigger) is also
  available as an alternative entry point to a plain `Webhook` node. Not used here — Next.js is
  the UI per `docs/ARCHITECTURE.md`, so a `Webhook` node (bearer-secret protected) stays the
  correct trigger for `WF-01`/`WF-02`, giving you full control over the request/response shape.
- Credentials already configured on the instance: Telegram, Slack, Tally, Airtable, **Groq**, and
  **Google Gemini**. No Postgres/Supabase, Fish Audio, OpenAI, or Anthropic credential exists yet
  — add a Postgres credential pointing at the Supabase connection string first, since the first
  real workflow step needs it. Groq and Gemini are both real candidates for the `LLM_MODEL` choice
  in `docs/AI_AGENT.md` — Groq specifically is worth prioritizing for the $1 budget and for the
  12% responsiveness score, since it's known for unusually low-latency, cheap inference; verify
  current Groq pricing/model availability before committing, since the AI_AGENT.md numbers are for
  budget sizing, not a locked-in vendor choice.

**Already built:** a "WF-01 Chat Coach" skeleton exists — `Webhook (POST /coach, header auth)` →
`Normalize Request (Set)` → `Validate Request (If: clinicId is UUID, message non-empty)` →
`Query Clinic Metrics (Postgres, groups customers by treatment)` → `Build Response (Code)` →
`Respond Success/Invalid/DB Error`. It's inactive, has no LLM node yet, and the Postgres node has
no credential attached yet — that's exactly right for where Phase 2 should be
(`docs/DEVELOPMENT_PLAN.md`): prove the wire before adding intelligence. Next concrete step: wire
a Postgres credential to it, activate it, confirm it round-trips from Next.js, then move to
Phase 3 (add the `AI Agent` node and the tool set).

## Workflow structure

Small, named, modular workflows — not one giant canvas:

```
WF-01  Chat Coach          — main chat entry point
WF-02  Voice Coach          — STT -> WF-01's agent logic -> TTS
WF-03  Knowledge Ingestion  — PDF/TXT upload -> chunk -> embed -> store
WF-04  Session Summary      — end-of-session summary + action plan
WF-05  Error Handler        — shared failure path, called from the others
```

Plus reusable **tool sub-workflows** where the logic is more than a single query — one per
non-trivial tool in `docs/AI_AGENT.md`. Simple SQL/RPC tools (`customer_lookup`,
`knowledge_search`) can instead be a `Postgres Tool` node attached directly to the Agent — see
"Confirmed on the instance" above.

## Use n8n's actual AI Agent primitives — don't hand-roll orchestration

n8n ships purpose-built nodes for exactly this pattern; use them instead of wiring tool selection
together from generic HTTP Request / IF / Switch nodes:

- **`AI Agent` node** (`@n8n/n8n-nodes-langchain.agent`) — the LangChain-based agent node that
  holds the system prompt, the chat model connection, and the list of connected tools, and handles
  the reasoning/tool-selection loop itself.
- **`Postgres Tool` node** (`n8n-nodes-base.postgresTool`) — attaches directly to the Agent for a
  simple parameterized query or RPC call; no wrapping sub-workflow needed.
- **`Call n8n Workflow Tool` node** — connects a sub-workflow to the Agent as a callable tool, for
  tools with real multi-step logic (`customer_analytics`, `kpi_calculator`).

## WF-01 — Chat Coach

```
Webhook (POST, bearer-secret protected)
  -> validate request (Zod-equivalent / n8n expression validation)
  -> load session context (Postgres node)
  -> AI Agent node (tools: customer_analytics, customer_lookup, knowledge_search, kpi_calculator,
     session_context)
  -> validate agent's structured output
  -> save user message + assistant message (Postgres node)
  -> return response JSON
```

## WF-02 — Voice Coach

```
Browser records audio -> upload -> n8n webhook
  -> Fish Audio STT (HTTP Request node, see docs/VOICE.md for the exact endpoint/auth)
  -> transcript feeds into the same logic as WF-01
  -> AI answer
  -> Fish Audio TTS
  -> audio returned to browser -> played
```

Reuse WF-01's agent logic via `Execute Workflow` rather than duplicating it — voice is a different
entry/exit point around the same coaching pipeline, never a separate reasoning system.

## WF-03 — Knowledge Ingestion

```
Upload PDF/TXT -> validate extension + size -> store document row -> extract text -> clean
  -> chunk (~500-800 tokens, ~50-100 overlap) -> generate embeddings -> store chunks
  -> mark document ready
```

See `docs/RAG.md` for the pipeline detail and `docs/DATABASE.md` for the underlying schema/index.

## Rules

- Every workflow has a clear input, a clear output, a validation step, a success path, and an
  error path (routed to WF-05 or an equivalent inline error branch) — never let a failed node
  produce a silently "successful-looking" response.
- Credentials live in n8n's credential store, never hardcoded into a node.
- Minimize LLM calls per request (see `docs/AI_AGENT.md` budget section) — one tool-selection +
  evidence-gathering pass, one final reasoning call, not a chatty back-and-forth.
- When debugging a failing workflow: identify the failing node, inspect its actual input/output,
  determine whether the fault is input, credential, API, transformation, or logic — then fix the
  root cause and re-run the whole workflow, not just the failing node in isolation.

## What this deliberately doesn't include

No self-hosted coding/agent harness called from n8n (e.g. a Claude Code CLI service) — see
`docs/ARCHITECTURE.md` decision log for why. n8n itself remains the entire orchestration layer.
