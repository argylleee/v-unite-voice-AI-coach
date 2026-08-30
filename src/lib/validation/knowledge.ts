import { z } from "zod";

// Knowledge-base upload limits (docs/SECURITY.md "File upload validation"): PDF/TXT only,
// rejected explicitly — never by failed parsing — plus a size cap and a per-clinic doc cap.

export const ALLOWED_EXTENSIONS = [".pdf", ".txt"] as const;
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  // browsers sometimes send this for .txt; extension is still checked
  "application/octet-stream",
] as const;
// 4 MB — deliberately under Vercel's ~4.5 MB serverless request-body limit, since the file is
// forwarded through this route to n8n. Clinic SOPs / policy docs are far smaller than this.
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_DOCS_PER_CLINIC = 25;

export type KnowledgeFileType = "pdf" | "txt";

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

export interface FileValidationInput {
  name: string;
  size: number;
  type: string;
}

export type FileValidationResult =
  | { ok: true; fileType: KnowledgeFileType }
  | { ok: false; error: string };

/** Validate a single uploaded file against the allowlist + size cap. */
export function validateUploadFile(file: FileValidationInput): FileValidationResult {
  const ext = extensionOf(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])) {
    return { ok: false, error: `unsupported_file_type: only ${ALLOWED_EXTENSIONS.join(", ")} are accepted` };
  }
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    return { ok: false, error: `unsupported_mime_type: ${file.type}` };
  }
  if (file.size <= 0) {
    return { ok: false, error: "empty_file" };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: `file_too_large: max ${MAX_FILE_BYTES} bytes` };
  }
  return { ok: true, fileType: ext === ".pdf" ? "pdf" : "txt" };
}

export const KnowledgeUploadMetaSchema = z.object({
  clinicId: z.string().uuid(),
});

export const KnowledgeListQuerySchema = z.object({
  clinicId: z.string().uuid(),
});

export const KnowledgeDocumentSchema = z.object({
  id: z.string().uuid(),
  clinic_id: z.string().uuid(),
  filename: z.string(),
  file_type: z.enum(["pdf", "txt"]),
  status: z.enum(["processing", "ready", "failed"]),
  created_at: z.string(),
  chunk_count: z.number().int().nonnegative(),
});

export type KnowledgeDocument = z.infer<typeof KnowledgeDocumentSchema>;
