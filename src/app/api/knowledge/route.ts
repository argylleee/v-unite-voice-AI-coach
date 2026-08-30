import { n8nKnowledgeConfig } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  KnowledgeListQuerySchema,
  KnowledgeUploadMetaSchema,
  MAX_DOCS_PER_CLINIC,
  validateUploadFile,
} from "@/lib/validation/knowledge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/knowledge — multipart upload (field `file` + `clinicId`). Validates the file
// (PDF/TXT only, size + per-clinic count caps, docs/SECURITY.md), then forwards it to the
// n8n knowledge-ingestion webhook (WF-03), which extracts/chunks/embeds/stores. No parsing
// or embedding happens here (docs/ARCHITECTURE.md — Next.js is presentation only).
export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false, error: "invalid_multipart" }, { status: 400 });
  }

  const meta = KnowledgeUploadMetaSchema.safeParse({ clinicId: form.get("clinicId") });
  if (!meta.success) {
    return Response.json(
      { ok: false, error: "invalid_request", issues: meta.error.flatten() },
      { status: 400 },
    );
  }
  const { clinicId } = meta.data;

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ ok: false, error: "missing_file" }, { status: 400 });
  }

  const check = validateUploadFile({ name: file.name, size: file.size, type: file.type });
  if (!check.ok) {
    return Response.json({ ok: false, error: check.error }, { status: 400 });
  }

  let config: { url: string; secret: string };
  try {
    config = n8nKnowledgeConfig();
  } catch (err) {
    console.error("[api/knowledge] misconfigured:", err);
    return Response.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
  }

  const supabase = createAdminClient();
  const existing = await supabase
    .from("knowledge_documents")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId);
  if (existing.error) {
    console.error("[api/knowledge] count query failed:", existing.error);
    return Response.json({ ok: false, error: "db_error" }, { status: 502 });
  }
  if ((existing.count ?? 0) >= MAX_DOCS_PER_CLINIC) {
    return Response.json(
      { ok: false, error: "document_limit_reached", limit: MAX_DOCS_PER_CLINIC },
      { status: 409 },
    );
  }

  const outbound = new FormData();
  outbound.append("file", file, file.name);
  outbound.append("clinicId", clinicId);
  outbound.append("filename", file.name);
  outbound.append("fileType", check.fileType);

  let res: Response;
  try {
    res = await fetch(config.url, {
      method: "POST",
      headers: { authorization: `Bearer ${config.secret}` },
      body: outbound,
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });
  } catch (err) {
    console.error("[api/knowledge] n8n ingestion call failed:", err);
    return Response.json({ ok: false, error: "upstream_error" }, { status: 502 });
  }

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    console.error("[api/knowledge] n8n ingestion returned", res.status, text.slice(0, 500));
    return Response.json(
      { ok: false, error: "upstream_error", upstreamStatus: res.status },
      { status: 502 },
    );
  }

  return Response.json({ ok: true, ...(body as object) }, { status: 202 });
}

// GET /api/knowledge?clinicId=<uuid> — list this clinic's documents + chunk counts + status,
// so the UI can show ingestion progress. Server-side read via the service-role key
// (docs/ARCHITECTURE.md decision #2).
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const query = KnowledgeListQuerySchema.safeParse({ clinicId: url.searchParams.get("clinicId") });
  if (!query.success) {
    return Response.json(
      { ok: false, error: "invalid_request", issues: query.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("id, clinic_id, filename, file_type, status, created_at, knowledge_chunks(count)")
    .eq("clinic_id", query.data.clinicId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[api/knowledge] list query failed:", error);
    return Response.json({ ok: false, error: "db_error" }, { status: 502 });
  }

  const documents = (data ?? []).map((row) => {
    const { knowledge_chunks, ...rest } = row as typeof row & {
      knowledge_chunks: { count: number }[] | null;
    };
    return { ...rest, chunk_count: knowledge_chunks?.[0]?.count ?? 0 };
  });

  return Response.json({ ok: true, documents }, { status: 200 });
}
