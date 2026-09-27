import { createHmac } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type Action = "session" | "coach" | "voice" | "knowledge" | "summary";
const LIMITS: Record<Action, { max: number; seconds: number }> = {
  session: { max: 12, seconds: 3600 },
  coach: { max: 10, seconds: 3600 },
  voice: { max: 4, seconds: 3600 },
  knowledge: { max: 2, seconds: 86400 },
  summary: { max: 4, seconds: 3600 },
};

/** Database-backed, atomic public-demo limit. Vercel overwrites X-Forwarded-For at its edge. */
export async function enforceDemoLimit(request: Request, action: Action): Promise<Response | null> {
  const rule = LIMITS[action];
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / rule.seconds) * rule.seconds;
  const ip = process.env.VERCEL ? request.headers.get("x-forwarded-for") : null;
  // Share a small bucket when the deployment does not supply a trusted IP header.
  const identity = ip?.split(",")[0]?.trim() || "unknown-client";
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return Response.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
  const fingerprint = createHmac("sha256", secret).update(identity).digest("hex");
  try {
    const { data, error } = await createAdminClient().rpc("reserve_demo_rate_limit", {
      p_fingerprint: fingerprint,
      p_action: action,
      p_window_start: new Date(windowStart * 1000).toISOString(),
      p_limit: rule.max,
    });
    if (error) throw error;
    if (data === true) return null;
    return Response.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(windowStart + rule.seconds - now) } },
    );
  } catch (err) {
    console.error(`[demo/limit] ${action} check failed:`, err);
    return Response.json({ ok: false, error: "rate_limit_unavailable" }, { status: 503 });
  }
}
