import { n8nKnowledgeConfig } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoClinic, newOrExistingVisitor, visitorHash } from "@/lib/demo/visitor";
import { enforceDemoLimit } from "@/lib/demo/rate-limit";
import { requireSyntheticDemoClinic } from "@/lib/demo/synthetic";
import {
  KnowledgeListQuerySchema,
  KnowledgeUploadMetaSchema,
  MAX_DOCS_PER_VISITOR,
  validateUploadFile,
  validateUploadContent,
} from "@/lib/validation/knowledge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/knowledge — multipart upload (field `file` + `clinicId`). Validates the file
// (PDF/TXT only, size + per-clinic count caps, docs/SECURITY.md), then forwards it to the
// n8n knowledge-ingestion webhook (WF-03), which extracts/chunks/embeds/stores. No parsing
// or embedding happens here (docs/ARCHITECTURE.md — Next.js is presentation only).
export async function POST(request: Request): Promise<Response> {
  const limited = await enforceDemoLimit(request, "knowledge");
  if (limited) return limited;
  const requestSize = Number(request.headers.get("content-length") ?? 0);
  if (requestSize > 4_500_000) {
    return Response.json({ ok: false, error: "file_too_large" }, { status: 413 });
  }
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
  if (!isDemoClinic(clinicId)) {
    return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const synthetic = await requireSyntheticDemoClinic();
  if (synthetic) return synthetic;

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ ok: false, error: "missing_file" }, { status: 400 });
  }

  const check = validateUploadFile({ name: file.name, size: file.size, type: file.type });
  if (!check.ok) {
    return Response.json({ ok: false, error: check.error }, { status: 400 });
  }
  const contentCheck = await validateUploadContent(file, check.fileType);
  if (!contentCheck.ok) {
    return Response.json({ ok: false, error: contentCheck.error }, { status: 400 });
  }
  const visitor = newOrExistingVisitor(request);

  let config: { url: string; secret: string };
  try {
    config = n8nKnowledgeConfig();
  } catch (err) {
    console.error("[api/knowledge] misconfigured:", err);
    return Response.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
  }

  let existing;
  try {
    const supabase = createAdminClient();
    existing = await supabase
    .from("knowledge_documents")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("visitor_token_hash", visitor.hash);
  } catch (err) {
    console.error("[api/knowledge] count query failed:", err);
    return Response.json({ ok: false, error: "db_error" }, { status: 502 });
  }
  if (existing.error) {
    console.error("[api/knowledge] count query failed:", existing.error);
    return Response.json({ ok: false, error: "db_error" }, { status: 502 });
  }
  if ((existing.count ?? 0) >= MAX_DOCS_PER_VISITOR) {
    return Response.json(
      { ok: false, error: "document_limit_reached", limit: MAX_DOCS_PER_VISITOR },
      { status: 409 },
    );
  }

  const outbound = new FormData();
  outbound.append("file", file, file.name);
  outbound.append("clinicId", clinicId);
  outbound.append("filename", file.name);
  outbound.append("fileType", check.fileType);
  outbound.append("visitorHash", visitor.hash);

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

  if (!body || typeof body !== "object" || (body as { ok?: unknown }).ok !== true) {
    return Response.json({ ok: false, error: "upstream_bad_response" }, { status: 502 });
  }
  const status = (body as { status?: unknown }).status === "ready" ? 200 : 202;
  const response = Response.json(body, { status });
  if (visitor.cookie) response.headers.set("Set-Cookie", visitor.cookie);
  return response;
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
  if (!isDemoClinic(query.data.clinicId)) {
    return Response.json({ ok: false, error: "not_found" }, { status: 404 });
  }
  const synthetic = await requireSyntheticDemoClinic();
  if (synthetic) return synthetic;

  const supabase = createAdminClient();
  let queryBuilder = supabase
    .from("knowledge_documents")
    .select("id, clinic_id, filename, file_type, status, created_at, knowledge_chunks(count)")
    .eq("clinic_id", query.data.clinicId);
  const visitor = visitorHash(request);
  queryBuilder = visitor
    ? queryBuilder.or(`demo_curated.eq.true,visitor_token_hash.eq.${visitor}`)
    : queryBuilder.eq("demo_curated", true);
  const { data, error } = await queryBuilder.order("created_at", { ascending: false });

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
