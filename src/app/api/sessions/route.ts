import { createSession, listSessions } from "@/lib/db/sessions";
import { CreateSessionSchema, SessionListQuerySchema } from "@/lib/validation/session";
import { isDemoClinic, newOrExistingVisitor, visitorHash } from "@/lib/demo/visitor";
import { enforceDemoLimit } from "@/lib/demo/rate-limit";
import { requireSyntheticDemoClinic } from "@/lib/demo/synthetic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/sessions — start a coaching session. Returns { id }.
export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = CreateSessionSchema.safeParse(raw);
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

  const limited = await enforceDemoLimit(request, "session");
  if (limited) return limited;
  const visitor = newOrExistingVisitor(request);

  try {
    const { id } = await createSession(parsed.data.clinicId, visitor.hash, parsed.data.title);
    const response = Response.json({ ok: true, id }, { status: 201 });
    if (visitor.cookie) response.headers.set("Set-Cookie", visitor.cookie);
    return response;
  } catch (err) {
    console.error("[api/sessions] create failed:", err);
    return Response.json({ ok: false, error: "db_error" }, { status: 502 });
  }
}

// GET /api/sessions?clinicId=<uuid> — list this clinic's sessions (newest first).
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = SessionListQuerySchema.safeParse({ clinicId: url.searchParams.get("clinicId") });
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
  if (!visitor) return Response.json({ ok: true, sessions: [] }, { status: 200 });

  try {
    const sessions = await listSessions(parsed.data.clinicId, visitor);
    return Response.json({ ok: true, sessions }, { status: 200 });
  } catch (err) {
    console.error("[api/sessions] list failed:", err);
    return Response.json({ ok: false, error: "db_error" }, { status: 502 });
  }
}
