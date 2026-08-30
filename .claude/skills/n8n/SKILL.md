---
name: n8n
description: Use when designing or editing n8n workflows, tool sub-workflows, or webhook orchestration.
---

# n8n

Read `docs/N8N.md` first. n8n is the main AI backend — a challenge requirement, not a preference.

## Rules

- Use n8n's native `AI Agent` / `Tools Agent` node for the reasoning/tool-selection loop, and the
  `Call n8n Workflow Tool` node to expose each tool sub-workflow to it. Don't hand-roll agent
  orchestration out of generic HTTP/IF/Switch nodes.
- Small, named, modular workflows (`WF-01` through `WF-05`, plus one sub-workflow per tool) —
  never one monolithic canvas.
- Every workflow: clear input, clear output, validation, a success path, an explicit error path.
- Credentials in n8n's credential store only — never hardcoded into a node.
- Webhooks require `Authorization: Bearer <N8N_WEBHOOK_SECRET>`, validated before anything else
  runs.
- Voice (`WF-02`) reuses the chat agent logic via `Execute Workflow` — it is not a separate
  reasoning system, only a different entry/exit point (STT in, TTS out).
- Minimize LLM calls per request.
- When debugging: isolate the failing node, inspect its actual input/output, classify the fault
  (input / credential / API / transformation / logic), fix the root cause, then re-run the whole
  workflow.
- No self-hosted coding/agent harness is called from n8n in this project — see
  `docs/ARCHITECTURE.md` decision log. n8n itself is the entire orchestration layer.
