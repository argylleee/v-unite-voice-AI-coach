import { n8nChatConfig } from "@/lib/env";
import { callN8nWebhook, N8nError } from "@/lib/n8n/client";
import { recordTurn, sessionBelongsToVisitor } from "@/lib/db/sessions";
import { isDemoClinic, visitorHash } from "@/lib/demo/visitor";
import { enforceDemoLimit } from "@/lib/demo/rate-limit";
import { requireSyntheticDemoClinic } from "@/lib/demo/synthetic";
import {
  FALLBACK_RESPONSE,
  parseAgentResponse,
  type AgentResponse,
} from "@/lib/validation/agent-response";
import { ChatRequestSchema } from "@/lib/validation/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow the self-hosted n8n coach enough time for model and tool calls while keeping
// the upstream timeout below the function limit.
export const maxDuration = 60;

// POST /api/coach — validates the request, forwards it server-side to the n8n chat webhook
// (bearer-secret protected), validates the agent's structured response, and returns it.
// No AI orchestration lives here (docs/ARCHITECTURE.md); the agent + tools live in n8n WF-01.
export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = ChatRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "invalid_request", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (!isDemoClinic(parsed.data.clinicId)) {
    return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const synthetic = await requireSyntheticDemoClinic();
  if (synthetic) return synthetic;
  const visitor = visitorHash(request);
  if (parsed.data.sessionId) {
    if (!visitor) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    try {
      if (!(await sessionBelongsToVisitor(parsed.data.sessionId, parsed.data.clinicId, visitor))) {
        return Response.json({ ok: false, error: "not_found" }, { status: 404 });
      }
    } catch (err) {
      console.error("[api/coach] session check failed:", err);
      return Response.json({ ok: false, error: "db_error" }, { status: 502 });
    }
  }

  const limited = await enforceDemoLimit(request, "coach");
  if (limited) return limited;

  let config: { url: string; secret: string };
  try {
    config = n8nChatConfig();
  } catch (err) {
    console.error("[api/coach] misconfigured:", err);
    return Response.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
  }

  try {
    // One n8n call per turn (docs/AI_AGENT.md budget rule); a second call only if the
    // first response fails schema validation.
    const payload = { ...parsed.data, visitorHash: visitor };
    let result = await callAndValidate(config, payload);
    if (!result) {
      console.warn("[api/coach] agent response failed validation — retrying once");
      result = await callAndValidate(config, payload);
    }
    if (!result) {
      console.error("[api/coach] agent response invalid twice — returning safe fallback");
      return Response.json({ ...FALLBACK_RESPONSE, degraded: true }, { status: 200 });
    }

    // Persist the turn if this request belongs to a session. Best-effort: a persistence
    // failure must not drop the coaching answer the user is waiting on.
    if (parsed.data.sessionId) {
      try {
        await recordTurn(
          parsed.data.sessionId,
          parsed.data.clinicId,
          visitor!,
          parsed.data.message,
          parsed.data.mode,
          result,
        );
      } catch (err) {
        console.error("[api/coach] recordTurn failed:", err);
      }
    }

    return Response.json(result, { status: 200 });
  } catch (err) {
    const status = err instanceof N8nError ? err.status : undefined;
    console.error("[api/coach] n8n call failed:", err);
    if (
      err instanceof N8nError &&
      err.body &&
      typeof err.body === "object" &&
      "error" in err.body &&
      err.body.error === "model_rate_limited"
    ) {
      return Response.json({ ok: false, error: "model_rate_limited" }, { status: 429 });
    }
    return Response.json(
      { ok: false, error: "upstream_error", upstreamStatus: status ?? null },
      { status: 502 },
    );
  }
}

// A hybrid coaching turn can be 2-4 tool calls (SQL + RAG) plus reasoning. On the free-tier
// n8n host a slow one lands around 15-40s; 55s leaves headroom without letting a wedged
// upstream hang the UI. Timeout failures are NOT retried (only schema-invalid output is).
const COACH_TIMEOUT_MS = 55_000;

async function callAndValidate(
  config: { url: string; secret: string },
  payload: unknown,
): Promise<AgentResponse | null> {
  const raw = await callN8nWebhook({
    url: config.url,
    secret: config.secret,
    payload,
    timeoutMs: COACH_TIMEOUT_MS,
  });
  return parseAgentResponse(raw);
}
