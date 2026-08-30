import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Supabase admin client is mocked (no live DB in CI); fetch to n8n is mocked
// (docs/TESTING.md). File validation, the per-clinic cap, and the forward contract are real.

const supabaseState: { count: number; countError: unknown; listData: unknown; listError: unknown } = {
  count: 0,
  countError: null,
  listData: [],
  listError: null,
};

function makeBuilder(): Record<string, unknown> {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = vi.fn((_cols: string, opts?: { head?: boolean }) => {
    builder._head = Boolean(opts?.head);
    return builder;
  });
  builder.eq = vi.fn(chain);
  builder.order = vi.fn(chain);
  builder.then = (resolve: (v: unknown) => unknown) =>
    resolve(
      builder._head
        ? { count: supabaseState.count, error: supabaseState.countError }
        : { data: supabaseState.listData, error: supabaseState.listError },
    );
  return builder;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: vi.fn(() => makeBuilder()) })),
}));

import { GET, POST } from "../../src/app/api/knowledge/route";

const CLINIC = "80a1c835-ed66-4c0c-8c3c-52c5e90fdbf4";
const N8N_URL = "https://n8n.example.test/webhook/knowledge";
const SECRET = "test-secret-123";

function uploadRequest(opts: {
  file?: File | null;
  clinicId?: string | null;
}): Request {
  const fd = new FormData();
  if (opts.file !== null && opts.file !== undefined) fd.append("file", opts.file, opts.file.name);
  if (opts.clinicId !== null) fd.append("clinicId", opts.clinicId ?? CLINIC);
  return new Request("http://localhost/api/knowledge", { method: "POST", body: fd });
}

function pdf(name = "policy.pdf", bytes = 2048): File {
  return new File([new Uint8Array(bytes)], name, { type: "application/pdf" });
}

beforeEach(() => {
  vi.stubEnv("N8N_KNOWLEDGE_WEBHOOK_URL", N8N_URL);
  vi.stubEnv("N8N_WEBHOOK_SECRET", SECRET);
  supabaseState.count = 0;
  supabaseState.countError = null;
  supabaseState.listData = [];
  supabaseState.listError = null;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("POST /api/knowledge", () => {
  it("rejects a non-multipart body with 400", async () => {
    const res = await POST(
      new Request("http://localhost/api/knowledge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_multipart" });
  });

  it("rejects a missing clinicId with 400", async () => {
    const res = await POST(uploadRequest({ file: pdf(), clinicId: null }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "invalid_request" });
  });

  it("rejects a missing file with 400", async () => {
    const res = await POST(uploadRequest({ file: null }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "missing_file" });
  });

  it("rejects a disallowed extension explicitly", async () => {
    const evil = new File([new Uint8Array(10)], "run.exe", { type: "application/octet-stream" });
    const res = await POST(uploadRequest({ file: evil }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("unsupported_file_type") });
  });

  it("rejects an oversize file", async () => {
    const big = new File([new Uint8Array(5 * 1024 * 1024)], "huge.pdf", { type: "application/pdf" });
    const res = await POST(uploadRequest({ file: big }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: expect.stringContaining("file_too_large") });
  });

  it("rejects once the per-clinic document limit is reached (409)", async () => {
    supabaseState.count = 25;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(uploadRequest({ file: pdf() }));

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "document_limit_reached", limit: 25 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards a valid upload to n8n with the bearer secret and returns 202", async () => {
    supabaseState.count = 3;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ documentId: "doc-1", status: "processing" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(uploadRequest({ file: pdf("sop.pdf") }));

    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ ok: true, documentId: "doc-1", status: "processing" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe(N8N_URL);
    expect(new Headers(init.headers).get("authorization")).toBe(`Bearer ${SECRET}`);
    const forwarded = init.body as FormData;
    expect(forwarded.get("clinicId")).toBe(CLINIC);
    expect(forwarded.get("fileType")).toBe("pdf");
    expect(forwarded.get("filename")).toBe("sop.pdf");
    expect(forwarded.get("file")).toBeInstanceOf(File);
  });

  it("maps an n8n failure to 502", async () => {
    supabaseState.count = 0;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("boom", { status: 500 })));
    const res = await POST(uploadRequest({ file: pdf() }));
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: "upstream_error" });
  });

  it("maps a thrown n8n call to 502", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    const res = await POST(uploadRequest({ file: pdf() }));
    expect(res.status).toBe(502);
  });

  it("returns 500 when the knowledge webhook env is missing", async () => {
    vi.stubEnv("N8N_KNOWLEDGE_WEBHOOK_URL", "");
    const res = await POST(uploadRequest({ file: pdf() }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "server_misconfigured" });
  });
});

describe("GET /api/knowledge", () => {
  it("rejects a missing/invalid clinicId with 400", async () => {
    const res = await GET(new Request("http://localhost/api/knowledge"));
    expect(res.status).toBe(400);
  });

  it("lists documents with chunk_count derived from the embedded count", async () => {
    supabaseState.listData = [
      {
        id: "11111111-1111-1111-1111-111111111111",
        clinic_id: CLINIC,
        filename: "SOP.pdf",
        file_type: "pdf",
        status: "ready",
        created_at: "2026-08-30T00:00:00Z",
        knowledge_chunks: [{ count: 12 }],
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        clinic_id: CLINIC,
        filename: "prices.txt",
        file_type: "txt",
        status: "processing",
        created_at: "2026-08-29T00:00:00Z",
        knowledge_chunks: [],
      },
    ];

    const res = await GET(
      new Request(`http://localhost/api/knowledge?clinicId=${CLINIC}`),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.documents).toHaveLength(2);
    expect(body.documents[0]).toMatchObject({ filename: "SOP.pdf", chunk_count: 12 });
    expect(body.documents[1]).toMatchObject({ filename: "prices.txt", chunk_count: 0 });
    expect(body.documents[0].knowledge_chunks).toBeUndefined();
  });

  it("maps a list query error to 502", async () => {
    supabaseState.listError = { message: "nope" };
    const res = await GET(
      new Request(`http://localhost/api/knowledge?clinicId=${CLINIC}`),
    );
    expect(res.status).toBe(502);
  });
});
