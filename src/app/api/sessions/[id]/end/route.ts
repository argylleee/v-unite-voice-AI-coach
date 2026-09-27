import { n8nSummaryConfig } from "@/lib/env";
import { callN8nWebhook, N8nError } from "@/lib/n8n/client";
import { finalizeSession, getSessionState, getTranscript } from "@/lib/db/sessions";
import { SessionIdParamSchema, SessionSummarySchema } from "@/lib/validation/session";
import { demoClinicId, visitorHash } from "@/lib/demo/visitor";
import { enforceDemoLimit } from "@/lib/demo/rate-limit";
import { requireSyntheticDemoClinic } from "@/lib/demo/synthetic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// End-of-session summary is one more DeepSeek call (WF-04). Hobby default 10s, max 60s.
export const maxDuration = 60;

// POST /api/sessions/<id>/end — load the transcript, ask WF-04 (one LLM call, docs/AI_AGENT.md)
// for { summary, key_findings, action_plan }, persist it, return it.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const parsed = SessionIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return Response.json({ ok: false, error: "invalid_session_id" }, { status: 400 });
  }
  const sessionId = parsed.data.id;
  const visitor = visitorHash(request);
  if (!visitor) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  const synthetic = await requireSyntheticDemoClinic();
  if (synthetic) return synthetic;
  const clinicId = demoClinicId();

  let transcript: { role: string; content: string }[];
  try {
    const state = await getSessionState(sessionId, clinicId, visitor);
    if (!state) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    if (state.ended_at && state.summary) {
      return Response.json({
        ok: true,
        summary: state.summary,
        key_findings: state.key_findings ?? [],
        action_plan: state.action_plan ?? [],
      });
    }
    transcript = await getTranscript(sessionId, clinicId, visitor);
  } catch (err) {
    console.error("[api/sessions/:id/end] transcript load failed:", err);
    return Response.json({ ok: false, error: "db_error" }, { status: 502 });
  }
  if (transcript.length === 0) {
    return Response.json({ ok: false, error: "empty_session" }, { status: 400 });
  }

  const limited = await enforceDemoLimit(request, "summary");
  if (limited) return limited;

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
    await finalizeSession(sessionId, clinicId, visitor, summary);
  } catch (err) {
    // A concurrent end request may have won the database transaction.
    const stored = await getSessionState(sessionId, clinicId, visitor).catch(() => null);
    if (stored?.ended_at && stored.summary) {
      return Response.json({
        ok: true,
        summary: stored.summary,
        key_findings: stored.key_findings ?? [],
        action_plan: stored.action_plan ?? [],
      });
    }
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
