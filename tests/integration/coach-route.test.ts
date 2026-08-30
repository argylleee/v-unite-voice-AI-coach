import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../src/app/api/coach/route";

// Integration path: request shape -> Zod validation -> orchestration call to n8n.
// The n8n HTTP call is mocked (allowed by docs/TESTING.md); validation and the
// request/response contract are exercised for real.

const WEBHOOK_URL = "https://n8n.example.test/webhook/coach";
const SECRET = "test-secret-123";
const VALID_BODY = {
  clinicId: "80a1c835-ed66-4c0c-8c3c-52c5e90fdbf4",
  message: "Which treatment needs attention?",
  mode: "chat" as const,
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/coach", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("N8N_CHAT_WEBHOOK_URL", WEBHOOK_URL);
  vi.stubEnv("N8N_WEBHOOK_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("POST /api/coach", () => {
  it("rejects a malformed JSON body with 400", async () => {
    const res = await POST(makeRequest("{not json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, error: "invalid_json" });
  });

  it("rejects an invalid request body with 400 and does not call n8n", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(makeRequest({ clinicId: "not-a-uuid", message: "" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ ok: false, error: "invalid_request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards a valid request to n8n with the bearer secret and returns its JSON", async () => {
    const upstream = {
      ok: true,
      clinicId: VALID_BODY.clinicId,
      echo: VALID_BODY.message,
      data: { customerCount: 100, treatments: [] },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(upstream), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(upstream);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe(WEBHOOK_URL);
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBe(`Bearer ${SECRET}`);
    expect(JSON.parse(init.body as string)).toMatchObject({
      clinicId: VALID_BODY.clinicId,
      message: VALID_BODY.message,
      mode: "chat",
    });
  });

  it("returns 502 when n8n responds with a non-2xx status", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("nope", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ ok: false, error: "upstream_error" });
  });

  it("returns 502 when the n8n call throws (network/timeout)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ ok: false, error: "upstream_error" });
  });

  it("returns 500 when the n8n webhook env vars are missing", async () => {
    vi.stubEnv("N8N_CHAT_WEBHOOK_URL", "");
    vi.stubEnv("N8N_WEBHOOK_SECRET", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ ok: false, error: "server_misconfigured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
