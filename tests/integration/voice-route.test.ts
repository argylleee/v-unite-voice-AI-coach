import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../src/app/api/voice/route";

const { recordTurn, sessionBelongsToVisitor } = vi.hoisted(() => ({
  recordTurn: vi.fn(),
  sessionBelongsToVisitor: vi.fn(),
}));
vi.mock("@/lib/db/sessions", () => ({ recordTurn, sessionBelongsToVisitor }));
vi.mock("@/lib/demo/rate-limit", () => ({ enforceDemoLimit: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/demo/synthetic", () => ({ requireSyntheticDemoClinic: vi.fn().mockResolvedValue(null) }));

// /api/voice forwards a recorded blob to the n8n voice webhook (WF-02) and validates
// { transcript, answer, audio_base64 } back. n8n + Fish Audio are mocked (docs/TESTING.md).

const N8N_URL = "https://n8n.example.test/webhook/voice";
const SECRET = "test-secret-123";
const CLINIC = "80a1c835-ed66-4c0c-8c3c-52c5e90fdbf4";

const GOOD_TURN = {
  transcript: "Which treatment needs attention?",
  answer: "CoolSculpting converts at 27.6%, the weakest of your treatments.",
  audio_base64: "SUQzBAAAAAA=", // arbitrary non-empty
  audio_mime: "audio/mpeg",
};

function audio(type = "audio/webm", bytes = 4096, name = "recording.webm"): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

function req(opts: { audio?: File | null; clinicId?: string | null; sessionId?: string }): Request {
  const fd = new FormData();
  if (opts.audio !== null && opts.audio !== undefined) fd.append("audio", opts.audio, opts.audio.name);
  if (opts.clinicId !== null) fd.append("clinicId", opts.clinicId ?? CLINIC);
  if (opts.sessionId) fd.append("sessionId", opts.sessionId);
  return new Request("http://localhost/api/voice", {
    method: "POST",
    headers: { cookie: `vu_demo_visitor=${"a".repeat(43)}` },
    body: fd,
  });
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  sessionBelongsToVisitor.mockResolvedValue(true);
  vi.stubEnv("N8N_VOICE_WEBHOOK_URL", N8N_URL);
  vi.stubEnv("N8N_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("NEXT_PUBLIC_CLINIC_ID", CLINIC);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("POST /api/voice", () => {
  it("rejects a non-multipart body", async () => {
    const res = await POST(
      new Request("http://localhost/api/voice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_multipart" });
  });

  it("rejects a missing clinicId", async () => {
    const res = await POST(req({ audio: audio(), clinicId: null }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_request" });
  });

  it("rejects a missing audio file", async () => {
    const res = await POST(req({ audio: null }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "missing_audio" });
  });

  it("rejects an unsupported audio type", async () => {
    const res = await POST(req({ audio: audio("application/pdf", 100, "x.pdf") }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: expect.stringContaining("unsupported_audio_type"),
    });
  });

  it("rejects an oversize recording", async () => {
    const res = await POST(req({ audio: audio("audio/webm", 9 * 1024 * 1024) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("audio_too_large") });
  });

  it("forwards the blob to n8n with the bearer secret and returns the voice turn", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(GOOD_TURN));
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req({ audio: audio() }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(GOOD_TURN);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(N8N_URL);
    expect(new Headers(init.headers).get("authorization")).toBe(`Bearer ${SECRET}`);
    const fwd = init.body as FormData;
    expect(fwd.get("audio")).toBeInstanceOf(File);
    expect(fwd.get("clinicId")).toBe(CLINIC);
    expect(fwd.get("mode")).toBe("voice");
  });

  it("stores a successful voice turn in its visitor-owned session", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(GOOD_TURN)));
    const sessionId = "22222222-2222-2222-2222-222222222222";
    const res = await POST(req({ audio: audio(), sessionId }));
    expect(res.status).toBe(200);
    expect(recordTurn).toHaveBeenCalledWith(
      sessionId, CLINIC, expect.any(String), GOOD_TURN.transcript, "voice",
      expect.objectContaining({ answer: GOOD_TURN.answer }),
    );
  });

  it("does not call n8n for another visitor's session", async () => {
    sessionBelongsToVisitor.mockResolvedValueOnce(false);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req({ audio: audio(), sessionId: "22222222-2222-2222-2222-222222222222" }));
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 502 when n8n fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));
    const res = await POST(req({ audio: audio() }));
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: "upstream_error" });
  });

  it("returns 502 with a text answer when the voice response is missing audio", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ transcript: "hi", answer: "Here is the answer without audio." }),
      ),
    );
    const res = await POST(req({ audio: audio() }));
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({
      error: "invalid_voice_response",
      answer: "Here is the answer without audio.",
    });
  });

  it("returns 500 when the voice webhook env is missing", async () => {
    vi.stubEnv("N8N_VOICE_WEBHOOK_URL", "");
    const res = await POST(req({ audio: audio() }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "server_misconfigured" });
  });
});
