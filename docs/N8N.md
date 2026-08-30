# n8n

n8n is the main AI backend and orchestration layer — an explicit challenge requirement (8% of the
rubric directly, and a prerequisite for the 18% agent-architecture and 17% end-to-end lines).
Access is provided by Emman/V-Unite; confirm workspace/credential setup with him early if
anything about the provided instance is unclear rather than guessing.

## Workflow structure

Small, named, modular workflows — not one giant canvas:

```
WF-01  Chat Coach          — main chat entry point
WF-02  Voice Coach          — STT -> WF-01's agent logic -> TTS
WF-03  Knowledge Ingestion  — PDF/TXT upload -> chunk -> embed -> store
WF-04  Session Summary      — end-of-session summary + action plan
WF-05  Error Handler        — shared failure path, called from the others
```

Plus reusable **tool sub-workflows**, one per tool in `docs/AI_AGENT.md`:
`TOOL-customer_analytics`, `TOOL-customer_lookup`, `TOOL-knowledge_search`,
`TOOL-kpi_calculator`, `TOOL-session_context`.

## Use n8n's actual AI Agent primitives — don't hand-roll orchestration

n8n ships purpose-built nodes for exactly this pattern; use them instead of wiring tool selection
together from generic HTTP Request / IF / Switch nodes:

- **`AI Agent` / `Tools Agent` node** — the LangChain-based agent node that holds the system
  prompt, the chat model connection, and the list of connected tools, and handles the
  reasoning/tool-selection loop itself.
- **`Call n8n Workflow Tool` node** — connects a sub-workflow (e.g. `TOOL-customer_analytics`) to
  the Agent node as a callable tool, with its own input schema. This is how the five tools in
  `docs/AI_AGENT.md` get exposed to the agent — each tool is its own small, independently
  testable sub-workflow, called by the agent node rather than pre-wired into a fixed branch.

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
