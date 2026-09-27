import { getSessionWithMessages } from "@/lib/db/sessions";
import { SessionIdParamSchema } from "@/lib/validation/session";
import { demoClinicId, visitorHash } from "@/lib/demo/visitor";
import { requireSyntheticDemoClinic } from "@/lib/demo/synthetic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/sessions/<id> — a session plus its messages in order.
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const parsed = SessionIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return Response.json({ ok: false, error: "invalid_session_id" }, { status: 400 });
  }
  const visitor = visitorHash(request);
  if (!visitor) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  const synthetic = await requireSyntheticDemoClinic();
  if (synthetic) return synthetic;

  try {
    const detail = await getSessionWithMessages(parsed.data.id, demoClinicId(), visitor);
    if (!detail) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return Response.json({ ok: true, ...detail }, { status: 200 });
  } catch (err) {
    console.error("[api/sessions/:id] failed:", err);
    return Response.json({ ok: false, error: "db_error" }, { status: 502 });
  }
}
