// Typed browser-side fetchers for the Next.js API routes. The UI never calls n8n, an LLM, or
// Supabase directly (docs/ARCHITECTURE.md) — everything goes through /api/*.

import type { AgentResponse, CoachApiResponse } from "@/lib/validation/agent-response";
import type { KnowledgeDocument } from "@/lib/validation/knowledge";
import type { SessionSummary } from "@/lib/validation/session";
import type { VoiceTurnResponse } from "@/lib/validation/voice";

export const CLINIC_ID =
  process.env.NEXT_PUBLIC_CLINIC_ID ?? "80a1c835-ed66-4c0c-8c3c-52c5e90fdbf4";
export const CLINIC_NAME = process.env.NEXT_PUBLIC_CLINIC_NAME ?? "V-Unite Aesthetic Clinic";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function readError(res: Response, fallback: string): Promise<never> {
  let code: string | undefined;
  try {
    const body = (await res.json()) as { error?: string };
    code = body?.error;
  } catch {
    /* no body */
  }
  throw new ApiError(code ? MESSAGES[code] ?? fallback : fallback, res.status, code);
}

const MESSAGES: Record<string, string> = {
  upstream_error: "The coach service didn't respond. Try again in a moment.",
  server_misconfigured: "The coach isn't configured on the server yet.",
  invalid_request: "That request wasn't valid.",
  db_error: "Couldn't reach the clinic records just now.",
  document_limit_reached: "This clinic has reached its uploaded-document limit.",
  empty_session: "This session has no messages to summarise yet.",
  invalid_summary_response: "The summary came back unreadable. Try ending the session again.",
  invalid_voice_response: "The voice reply came back without audio.",
};

// ---- coach ----

export interface CoachRequest {
  message: string;
  mode: "chat" | "voice";
  sessionId?: string;
}

export async function askCoach(req: CoachRequest): Promise<CoachApiResponse> {
  const res = await fetch("/api/coach", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clinicId: CLINIC_ID, ...req }),
  });
  if (!res.ok) return readError(res, "The coach couldn't answer that.");
  return (await res.json()) as CoachApiResponse;
}

export async function askCoachByVoice(
  audio: Blob,
  sessionId?: string,
): Promise<VoiceTurnResponse> {
  const form = new FormData();
  form.append("audio", audio, "turn.webm");
  form.append("clinicId", CLINIC_ID);
  if (sessionId) form.append("sessionId", sessionId);
  const res = await fetch("/api/voice", { method: "POST", body: form });
  if (!res.ok) return readError(res, "Couldn't process that recording.");
  return (await res.json()) as VoiceTurnResponse;
}

export type { AgentResponse, CoachApiResponse };

// ---- sessions ----

export interface SessionListItem {
  id: string;
  title: string | null;
  started_at: string;
  ended_at: string | null;
  has_summary: boolean;
  message_count: number;
}

export interface SessionMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  input_mode: "chat" | "voice";
  evidence: unknown;
  created_at: string;
}

export interface SessionDetail {
  session: {
    id: string;
    title: string | null;
    started_at: string;
    ended_at: string | null;
    summary: string | null;
    key_findings: string[] | null;
    action_plan: { action: string; priority: string }[] | null;
  };
  messages: SessionMessage[];
}

export async function createSession(title?: string): Promise<string> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clinicId: CLINIC_ID, title }),
  });
  if (!res.ok) return readError(res, "Couldn't start a session.");
  return ((await res.json()) as { id: string }).id;
}

export async function listSessions(): Promise<SessionListItem[]> {
  const res = await fetch(`/api/sessions?clinicId=${CLINIC_ID}`, { cache: "no-store" });
  if (!res.ok) return readError(res, "Couldn't load sessions.");
  return ((await res.json()) as { sessions: SessionListItem[] }).sessions;
}

export async function getSession(id: string): Promise<SessionDetail> {
  const res = await fetch(`/api/sessions/${id}`, { cache: "no-store" });
  if (!res.ok) return readError(res, "Couldn't load that session.");
  const body = (await res.json()) as SessionDetail;
  return body;
}

export async function endSession(id: string): Promise<SessionSummary> {
  const res = await fetch(`/api/sessions/${id}/end`, { method: "POST" });
  if (!res.ok) return readError(res, "Couldn't summarise the session.");
  return (await res.json()) as SessionSummary;
}

// ---- knowledge ----

export async function listDocuments(): Promise<KnowledgeDocument[]> {
  const res = await fetch(`/api/knowledge?clinicId=${CLINIC_ID}`, { cache: "no-store" });
  if (!res.ok) return readError(res, "Couldn't load documents.");
  return ((await res.json()) as { documents: KnowledgeDocument[] }).documents;
}

export async function uploadDocument(file: File): Promise<{ documentId?: string }> {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("clinicId", CLINIC_ID);
  const res = await fetch("/api/knowledge", { method: "POST", body: form });
  if (!res.ok) return readError(res, "That upload was rejected.");
  return (await res.json()) as { documentId?: string };
}
