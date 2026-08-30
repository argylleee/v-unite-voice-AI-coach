# WF-05 — Error Handler (shared failure path)

`docs/N8N.md` calls for a shared error workflow the other four call from their error branches,
"never let a failed node produce a silently successful-looking response." WF-01/02/03/04 already
have inline error branches that respond 4xx/5xx; WF-05 gives them **one** place to normalise the
error shape and log it, so the envelope Next.js receives is consistent across every workflow.

Import file: `n8n/workflows/wf-05-error-handler.json`. No credentials required.

## What it does

`When Called` (Execute Workflow Trigger, passthrough)
→ `Normalize Error` (Code) — coerces the caller's context into
  `{ workflow, stage, code, statusCode, requestId, message, at }`, clamps `statusCode` to
  400–599 (default 502), and writes one `[WF-05] {...}` line to the execution log.
→ `Build Error Response` (Code) — emits
  `{ statusCode, response: { ok:false, error, message, workflow, stage, requestId } }`.

The caller reads `statusCode` for its `Respond to Webhook` node's status and `response` for the
body. No clinic data is included in the envelope.

## Input the callers should pass

```json
{
  "workflow": "WF-01",
  "stage": "AI Coach Agent",
  "code": "agent_failed",
  "statusCode": 502,
  "message": "{{ $json.error.message }}",
  "requestId": "{{ $json.requestId }}"
}
```

All fields optional — `Normalize Error` fills sensible defaults (`statusCode` 502,
`code` `workflow_failed`, `requestId` falls back to `$execution.id`).

## Wiring it into WF-01 / WF-02 / WF-03 / WF-04

For each workflow, on the error output of the node that can fail (the Agent, the HTTP nodes,
the Postgres nodes), instead of going straight to a hand-built `Respond` node:

1. Add an **Execute Workflow** node → select `WF-05 Error Handler` → *Source: Database*, pick the
   workflow. Set its input to the JSON above (fill `workflow`/`stage` per call site).
2. Point the existing `Respond to Webhook (error)` node at WF-05's output:
   - Respond With: **JSON** → `{{ $json.response }}`
   - Options → Response Code → `{{ $json.statusCode }}`
3. Keep the wiring: `failing node (error output) → Execute WF-05 → Respond (error)`.

This is additive — the success paths are untouched, and if WF-05 itself errors the caller's
`Respond (error)` still fires with its previous static 502 as the fallback.

## Live import

Same procedure as every other workflow in this repo (`n8n/MIGRATION.md`): import the JSON on the
Railway instance (`primary-production-c0ce.up.railway.app`), or `POST /api/v1/workflows` with the
n8n API key. Then activate it and add the Execute Workflow calls in WF-01/02/03/04.

Status: JSON + this guide are ready; the live import + per-workflow wiring is a manual n8n step
(tracked in `STATUS.md` Phase 9).
