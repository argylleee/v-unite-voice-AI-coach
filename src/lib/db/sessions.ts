import { createAdminClient } from "@/lib/supabase/admin";
import type { AgentResponse } from "@/lib/validation/agent-response";
import type { SessionSummary } from "@/lib/validation/session";

// Server-side session/message persistence (service-role key). Callers are Next.js API routes.

export async function createSession(clinicId: string, visitorTokenHash: string, title?: string): Promise<{ id: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("coaching_sessions")
    .insert({ clinic_id: clinicId, visitor_token_hash: visitorTokenHash, title: title ?? null })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id as string };
}

export interface SessionListItem {
  id: string;
  title: string | null;
  started_at: string;
  ended_at: string | null;
  has_summary: boolean;
  message_count: number;
}

export async function listSessions(clinicId: string, visitorTokenHash: string): Promise<SessionListItem[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("coaching_sessions")
    .select("id, title, started_at, ended_at, summary, messages(count)")
    .eq("clinic_id", clinicId)
    .eq("visitor_token_hash", visitorTokenHash)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const { messages, summary, ...rest } = row as typeof row & {
      messages: { count: number }[] | null;
      summary: string | null;
    };
    return {
      ...rest,
      has_summary: Boolean(summary),
      message_count: messages?.[0]?.count ?? 0,
    };
  });
}

export interface SessionDetail {
  session: Record<string, unknown>;
  messages: Record<string, unknown>[];
}

export async function getSessionWithMessages(
  sessionId: string,
  clinicId: string,
  visitorTokenHash: string,
): Promise<SessionDetail | null> {
  const supabase = createAdminClient();
  const sessionRes = await supabase
    .from("coaching_sessions")
    .select("id, clinic_id, title, started_at, ended_at, summary, key_findings, action_plan")
    .eq("id", sessionId)
    .eq("clinic_id", clinicId)
    .eq("visitor_token_hash", visitorTokenHash)
    .maybeSingle();
  if (sessionRes.error) throw sessionRes.error;
  if (!sessionRes.data) return null;

  const msgRes = await supabase
    .from("messages")
    .select("id, role, content, input_mode, evidence, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (msgRes.error) throw msgRes.error;

  return { session: sessionRes.data, messages: msgRes.data ?? [] };
}

export async function sessionBelongsToVisitor(
  sessionId: string,
  clinicId: string,
  visitorTokenHash: string,
): Promise<boolean> {
  const { data, error } = await createAdminClient()
    .from("coaching_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("clinic_id", clinicId)
    .eq("visitor_token_hash", visitorTokenHash)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

/** Append a user turn + the coach's answer to a session. Best-effort — callers log, don't fail. */
export async function recordTurn(
  sessionId: string,
  clinicId: string,
  visitorTokenHash: string,
  userMessage: string,
  mode: "chat" | "voice",
  answer: AgentResponse,
): Promise<void> {
  if (!(await sessionBelongsToVisitor(sessionId, clinicId, visitorTokenHash))) {
    throw new Error("session_not_found");
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("messages").insert([
    { session_id: sessionId, role: "user", content: userMessage, input_mode: mode },
    {
      session_id: sessionId,
      role: "assistant",
      content: answer.answer,
      input_mode: mode,
      evidence: {
        insights: answer.insights,
        evidence: answer.evidence,
        recommendations: answer.recommendations,
        follow_up_question: answer.follow_up_question,
      },
    },
  ]);
  if (error) throw error;
}

/** Persist the end-of-session summary + action plan (coaching_sessions + action_plans rows). */
export async function finalizeSession(
  sessionId: string,
  clinicId: string,
  visitorTokenHash: string,
  summary: SessionSummary,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("finalize_demo_session", {
    p_session_id: sessionId,
    p_clinic_id: clinicId,
    p_visitor_token_hash: visitorTokenHash,
    p_summary: summary.summary,
    p_key_findings: summary.key_findings,
    p_action_plan: summary.action_plan,
  });
  if (error) throw error;
}

export async function getSessionState(
  sessionId: string,
  clinicId: string,
  visitorTokenHash: string,
): Promise<{ ended_at: string | null; summary: string | null; key_findings: string[] | null; action_plan: SessionSummary["action_plan"] | null } | null> {
  const { data, error } = await createAdminClient()
    .from("coaching_sessions")
    .select("ended_at, summary, key_findings, action_plan")
    .eq("id", sessionId)
    .eq("clinic_id", clinicId)
    .eq("visitor_token_hash", visitorTokenHash)
    .maybeSingle();
  if (error) throw error;
  return data as typeof data & { key_findings: string[] | null; action_plan: SessionSummary["action_plan"] | null };
}

/** The transcript WF-04 summarizes. */
export async function getTranscript(sessionId: string, clinicId: string, visitorTokenHash: string): Promise<
  { role: string; content: string }[]
> {
  if (!(await sessionBelongsToVisitor(sessionId, clinicId, visitorTokenHash))) {
    throw new Error("session_not_found");
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("messages")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as { role: string; content: string }[];
}
