import { n8nChatConfig } from "@/lib/env";
import { callN8nWebhook, N8nError } from "@/lib/n8n/client";
import {
  FALLBACK_RESPONSE,
  parseAgentResponse,
  type AgentResponse,
} from "@/lib/validation/agent-response";
import { ChatRequestSchema } from "@/lib/validation/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    let result = await callAndValidate(config, parsed.data);
    if (!result) {
      console.warn("[api/coach] agent response failed validation — retrying once");
      result = await callAndValidate(config, parsed.data);
    }
    if (!result) {
      console.error("[api/coach] agent response invalid twice — returning safe fallback");
      return Response.json({ ...FALLBACK_RESPONSE, degraded: true }, { status: 200 });
    }
    return Response.json(result, { status: 200 });
  } catch (err) {
    const status = err instanceof N8nError ? err.status : undefined;
    console.error("[api/coach] n8n call failed:", err);
    return Response.json(
      { ok: false, error: "upstream_error", upstreamStatus: status ?? null },
      { status: 502 },
    );
  }
}

// A coaching turn is an LLM reason-pass + tool calls + a format pass — seconds, not sub-second.
// Generous enough that a warm agent turn never trips it; short enough that a wedged upstream
// still fails fast-ish. Network/timeout failures are NOT retried (only schema-invalid output is).
const COACH_TIMEOUT_MS = 45_000;

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
