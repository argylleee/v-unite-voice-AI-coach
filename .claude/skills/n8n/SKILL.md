---
name: n8n
description: Use when reasoning about n8n workflow design, tool architecture, or the webhook contract Next.js integrates against — not for editing workflows directly, see Build ownership below.
---

# n8n

Read `docs/N8N.md` first. n8n is the main AI backend — a challenge requirement, not a preference.

## Build ownership (important — read before touching anything n8n-related)

The user builds n8n workflows themselves, by hand, in the n8n editor on the self-hosted instance
(`docs/N8N.md`, `docs/ARCHITECTURE.md` decision #6) — this is deliberate, not a gap to fill in.
Claude Code's role here is: keep the Next.js side's webhook contract (request/response shapes,
env var names in `.env.example`) in sync with what the workflows actually expect, and help
diagnose issues when asked — not to build, edit, or "helpfully" complete n8n workflows via MCP
tools unless the user explicitly asks for a specific change. If a task seems to call for editing
an n8n workflow, stop and confirm with the user first.

## Rules (for advising / reviewing, and for keeping the Next.js side in sync)

- Use n8n's native `AI Agent` node for the reasoning/tool-selection loop. Simple query/RPC tools
  (`customer_lookup`, `knowledge_search`) attach as a direct `Postgres Tool` node; multi-step
  tools (`customer_analytics`, `kpi_calculator`) use a `Call n8n Workflow Tool` sub-workflow.
  Don't hand-roll agent orchestration out of generic HTTP/IF/Switch nodes.
- Small, named, modular workflows (`WF-01` through `WF-05`, plus one sub-workflow per non-trivial
  tool) — never one monolithic canvas.
- Every workflow: clear input, clear output, validation, a success path, an explicit error path.
- Credentials in n8n's credential store only — never hardcoded into a node.
- Webhooks require `Authorization: Bearer <N8N_WEBHOOK_SECRET>`, validated before anything else
  runs.
- Voice (`WF-02`) reuses the chat agent logic via `Execute Workflow` — it is not a separate
  reasoning system, only a different entry/exit point (STT in, TTS out).
- Minimize LLM calls per request.
- When helping debug: isolate the failing node, inspect its actual input/output, classify the
  fault (input / credential / API / transformation / logic) — then let the user fix the root
  cause and re-run the whole workflow.
- No self-hosted coding/agent harness is called from n8n in this project — see
  `docs/ARCHITECTURE.md` decision log. n8n itself is the entire orchestration layer.
- Development instance is self-hosted; migrate exported workflow JSON to V-Unite's instance
  before submission, once Emman confirms that's acceptable (`docs/N8N.md`).
