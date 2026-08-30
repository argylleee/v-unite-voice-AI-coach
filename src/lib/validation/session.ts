import { z } from "zod";

// Coaching-session lifecycle schemas (docs/DATABASE.md: coaching_sessions, messages,
// action_plans). Sessions/messages are written server-side via the service-role key
// (docs/ARCHITECTURE.md decision #2) — never a browser Supabase client.

export const CreateSessionSchema = z.object({
  clinicId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
});

export const SessionListQuerySchema = z.object({
  clinicId: z.string().uuid(),
});

export const SessionIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const MESSAGE_ROLES = ["user", "assistant", "system"] as const;

// The end-of-session artifact WF-04 produces and /api/sessions/[id]/end persists.
export const ActionItemSchema = z.object({
  action: z.string().min(1),
  priority: z.enum(["high", "medium", "low"]).catch("medium").default("medium"),
});

export const SessionSummarySchema = z.object({
  summary: z.string().min(1),
  key_findings: z.array(z.string()).catch([]).default([]),
  action_plan: z.array(ActionItemSchema).catch([]).default([]),
});

export type ActionItem = z.infer<typeof ActionItemSchema>;
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

// Row shapes returned to the frontend.
export const SessionRowSchema = z.object({
  id: z.string().uuid(),
  clinic_id: z.string().uuid(),
  title: z.string().nullable(),
  started_at: z.string(),
  ended_at: z.string().nullable(),
  summary: z.string().nullable(),
  key_findings: z.unknown().nullable(),
  action_plan: z.unknown().nullable(),
});

export type SessionRow = z.infer<typeof SessionRowSchema>;
