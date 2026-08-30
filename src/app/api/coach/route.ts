import { n8nChatConfig } from "@/lib/env";
import { callN8nWebhook, N8nError } from "@/lib/n8n/client";
import { ChatRequestSchema } from "@/lib/validation/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/coach — validates the request, forwards it server-side to the n8n chat webhook
// (bearer-secret protected), and returns n8n's JSON. No AI orchestration lives here
// (docs/ARCHITECTURE.md); Phase 2 proves this wire before the agent is added in Phase 3.
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
    const result = await callN8nWebhook({
      url: config.url,
      secret: config.secret,
      payload: parsed.data,
    });
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
