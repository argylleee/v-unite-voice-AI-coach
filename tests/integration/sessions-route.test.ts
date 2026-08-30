import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The DB layer (@/lib/db/sessions) is mocked — it needs a live Supabase, which CI lacks.
// These tests cover the route contract: validation, status codes, and the WF-04 wiring.

const db = {
  createSession: vi.fn(),
  listSessions: vi.fn(),
  getSessionWithMessages: vi.fn(),
  getTranscript: vi.fn(),
  finalizeSession: vi.fn(),
  recordTurn: vi.fn(),
};
vi.mock("@/lib/db/sessions", () => db);

const { POST: createPost, GET: listGet } = await import("../../src/app/api/sessions/route");
const { GET: detailGet } = await import("../../src/app/api/sessions/[id]/route");
const { POST: endPost } = await import("../../src/app/api/sessions/[id]/end/route");

const CLINIC = "80a1c835-ed66-4c0c-8c3c-52c5e90fdbf4";
const SESSION = "11111111-1111-1111-1111-111111111111";
const SUMMARY_URL = "https://n8n.example.test/webhook/summary";
const SECRET = "test-secret-123";

function jsonReq(url: string, body?: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.stubEnv("N8N_SUMMARY_WEBHOOK_URL", SUMMARY_URL);
  vi.stubEnv("N8N_WEBHOOK_SECRET", SECRET);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("POST /api/sessions", () => {
  it("creates a session", async () => {
    db.createSession.mockResolvedValue({ id: SESSION });
    const res = await createPost(jsonReq("http://localhost/api/sessions", { clinicId: CLINIC }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, id: SESSION });
    expect(db.createSession).toHaveBeenCalledWith(CLINIC, undefined);
  });

  it("rejects a bad clinicId", async () => {
    const res = await createPost(jsonReq("http://localhost/api/sessions", { clinicId: "nope" }));
    expect(res.status).toBe(400);
    expect(db.createSession).not.toHaveBeenCalled();
  });

  it("maps a DB error to 502", async () => {
    db.createSession.mockRejectedValue(new Error("boom"));
    const res = await createPost(jsonReq("http://localhost/api/sessions", { clinicId: CLINIC }));
    expect(res.status).toBe(502);
  });
});

describe("GET /api/sessions", () => {
  it("lists sessions for a clinic", async () => {
    db.listSessions.mockResolvedValue([
      { id: SESSION, title: null, started_at: "t", ended_at: null, has_summary: false, message_count: 4 },
    ]);
    const res = await listGet(new Request(`http://localhost/api/sessions?clinicId=${CLINIC}`));
    expect(res.status).toBe(200);
    expect((await res.json()).sessions).toHaveLength(1);
  });

  it("400 on missing clinicId", async () => {
    const res = await listGet(new Request("http://localhost/api/sessions"));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/sessions/:id", () => {
  it("returns the session + messages", async () => {
    db.getSessionWithMessages.mockResolvedValue({
      session: { id: SESSION },
      messages: [{ role: "user", content: "hi" }],
    });
    const res = await detailGet(new Request("http://localhost/x"), {
      params: Promise.resolve({ id: SESSION }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, session: { id: SESSION } });
  });

  it("404 when the session does not exist", async () => {
    db.getSessionWithMessages.mockResolvedValue(null);
    const res = await detailGet(new Request("http://localhost/x"), {
      params: Promise.resolve({ id: SESSION }),
    });
    expect(res.status).toBe(404);
  });

  it("400 on a non-uuid id", async () => {
    const res = await detailGet(new Request("http://localhost/x"), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/sessions/:id/end", () => {
  const GOOD_SUMMARY = {
    summary: "You focused on CoolSculpting's weak conversion and the consultation SOP.",
    key_findings: ["CoolSculpting converts at 27.6%", "SOP mandates expectation-setting"],
    action_plan: [
      { action: "Audit 5 recent CoolSculpting consults against SOP 3.2", priority: "high" },
      { action: "Re-engage the 13 lapsed CoolSculpting customers", priority: "medium" },
    ],
  };

  it("summarizes via WF-04, persists, and returns the summary", async () => {
    db.getTranscript.mockResolvedValue([
      { role: "user", content: "which treatment needs attention" },
      { role: "assistant", content: "CoolSculpting..." },
    ]);
    db.finalizeSession.mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(GOOD_SUMMARY), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await endPost(new Request("http://localhost/x", { method: "POST" }), {
      params: Promise.resolve({ id: SESSION }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, summary: GOOD_SUMMARY.summary });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(SUMMARY_URL);
    expect(new Headers(init.headers).get("authorization")).toBe(`Bearer ${SECRET}`);
    expect(db.finalizeSession).toHaveBeenCalledWith(
      SESSION,
      expect.objectContaining({ summary: GOOD_SUMMARY.summary }),
    );
  });

  it("400 on an empty session", async () => {
    db.getTranscript.mockResolvedValue([]);
    const res = await endPost(new Request("http://localhost/x", { method: "POST" }), {
      params: Promise.resolve({ id: SESSION }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "empty_session" });
  });

  it("502 when WF-04 returns an unusable summary", async () => {
    db.getTranscript.mockResolvedValue([{ role: "user", content: "hi" }]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ nope: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const res = await endPost(new Request("http://localhost/x", { method: "POST" }), {
      params: Promise.resolve({ id: SESSION }),
    });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: "invalid_summary_response" });
    expect(db.finalizeSession).not.toHaveBeenCalled();
  });

  it("502 when the WF-04 call fails", async () => {
    db.getTranscript.mockResolvedValue([{ role: "user", content: "hi" }]);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    const res = await endPost(new Request("http://localhost/x", { method: "POST" }), {
      params: Promise.resolve({ id: SESSION }),
    });
    expect(res.status).toBe(502);
  });
});
