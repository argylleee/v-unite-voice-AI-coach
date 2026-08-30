import { n8nSummaryConfig } from "@/lib/env";
import { callN8nWebhook, N8nError } from "@/lib/n8n/client";
import { finalizeSession, getTranscript } from "@/lib/db/sessions";
import { SessionIdParamSchema, SessionSummarySchema } from "@/lib/validation/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/sessions/<id>/end — load the transcript, ask WF-04 (one LLM call, docs/AI_AGENT.md)
// for { summary, key_findings, action_plan }, persist it, return it.
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const parsed = SessionIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return Response.json({ ok: false, error: "invalid_session_id" }, { status: 400 });
  }
  const sessionId = parsed.data.id;

  let transcript: { role: string; content: string }[];
  try {
    transcript = await getTranscript(sessionId);
  } catch (err) {
    console.error("[api/sessions/:id/end] transcript load failed:", err);
    return Response.json({ ok: false, error: "db_error" }, { status: 502 });
  }
  if (transcript.length === 0) {
    return Response.json({ ok: false, error: "empty_session" }, { status: 400 });
  }

  let config: { url: string; secret: string };
  try {
    config = n8nSummaryConfig();
  } catch (err) {
    console.error("[api/sessions/:id/end] misconfigured:", err);
    return Response.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
  }

  let summary;
  try {
    const raw = await callN8nWebhook({
      url: config.url,
      secret: config.secret,
      payload: { sessionId, transcript },
      timeoutMs: 60_000,
    });
    const candidate = unwrap(raw);
    const check = SessionSummarySchema.safeParse(candidate);
    if (!check.success) {
      console.error("[api/sessions/:id/end] WF-04 response failed validation");
      return Response.json({ ok: false, error: "invalid_summary_response" }, { status: 502 });
    }
    summary = check.data;
  } catch (err) {
    const status = err instanceof N8nError ? err.status : undefined;
    console.error("[api/sessions/:id/end] WF-04 call failed:", err);
    return Response.json(
      { ok: false, error: "upstream_error", upstreamStatus: status ?? null },
      { status: 502 },
    );
  }

  try {
    await finalizeSession(sessionId, summary);
  } catch (err) {
    console.error("[api/sessions/:id/end] persist failed:", err);
    return Response.json({ ok: false, error: "db_error", summary }, { status: 502 });
  }

  return Response.json({ ok: true, ...summary }, { status: 200 });
}

// WF-04 may wrap the object (Code/Set node -> { output | data | agent_output }).
function unwrap(raw: unknown): unknown {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["output", "data", "agent_output", "json", "result"]) {
      if (obj[key] && typeof obj[key] === "object") return obj[key];
      if (typeof obj[key] === "string") {
        try {
          return JSON.parse((obj[key] as string).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, ""));
        } catch {
          /* fall through */
        }
      }
    }
  }
  return raw;
}
