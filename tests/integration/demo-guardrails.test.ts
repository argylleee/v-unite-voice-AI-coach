import { afterEach, describe, expect, it, vi } from "vitest";
import { newOrExistingVisitor, visitorHash } from "../../src/lib/demo/visitor";

const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc }) }));
const { enforceDemoLimit } = await import("../../src/lib/demo/rate-limit");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("public demo visitor isolation", () => {
  it("issues an HttpOnly visitor cookie and recognizes only that cookie", () => {
    const request = new Request("https://demo.example.test/api/sessions");
    const visitor = newOrExistingVisitor(request);
    expect(visitor.cookie).toContain("HttpOnly");
    expect(visitor.cookie).toContain("SameSite=Lax");
    expect(visitor.cookie).toContain("Secure");
    const cookie = visitor.cookie!.split(";")[0];
    expect(visitorHash(new Request(request.url, { headers: { cookie } }))).toBe(visitor.hash);
    expect(visitorHash(request)).toBeNull();
    expect(visitorHash(new Request(request.url, { headers: { cookie: "vu_demo_visitor=short" } }))).toBeNull();
  });
});

describe("atomic demo rate limit", () => {
  it("returns 429 with retry timing after the database denies a reservation", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only-secret");
    vi.stubEnv("VERCEL", "1");
    rpc.mockResolvedValue({ data: false, error: null });
    const request = new Request("https://demo.example.test/api/coach", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });
    const response = await enforceDemoLimit(request, "coach");
    expect(response?.status).toBe(429);
    expect(Number(response?.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(rpc).toHaveBeenCalledWith("reserve_demo_rate_limit", expect.objectContaining({
      p_action: "coach", p_limit: 10,
      p_fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
    }));
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("203.0.113.10");
  });

  it("fails closed if the database cannot enforce the limit", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only-secret");
    rpc.mockResolvedValue({ data: null, error: { message: "db unavailable" } });
    const response = await enforceDemoLimit(new Request("https://demo.example.test/api/coach"), "coach");
    expect(response?.status).toBe(503);
  });
});
