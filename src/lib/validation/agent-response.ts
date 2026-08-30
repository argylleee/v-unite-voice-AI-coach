import { z } from "zod";

// The agent's structured output, standardized before it reaches the frontend
// (docs/AI_AGENT.md "Response schema"). Next.js validates every n8n response against this;
// on failure it retries once, then falls back to a safe generic response — an unvalidated
// blob must never reach the UI (docs/SECURITY.md "AI output validation").

export const EvidenceItemSchema = z.object({
  type: z.enum(["customer_data", "knowledge_base"]),
  description: z.string().min(1),
  source: z.string().nullable().catch(null).default(null),
});

export const AgentResponseSchema = z.object({
  answer: z.string().min(1),
  insights: z.array(z.string()).catch([]).default([]),
  evidence: z.array(EvidenceItemSchema).catch([]).default([]),
  recommendations: z.array(z.string()).catch([]).default([]),
  follow_up_question: z.string().nullable().catch(null).default(null),
});

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
export type AgentResponse = z.infer<typeof AgentResponseSchema>;

// Shape the frontend actually receives from POST /api/coach: the validated agent response,
// plus `degraded: true` when the safe fallback had to be used.
export type CoachApiResponse = AgentResponse & { degraded?: boolean };

export const FALLBACK_RESPONSE: AgentResponse = {
  answer:
    "I couldn't put together a reliable answer just now. Please try asking again, or rephrase your question.",
  insights: [],
  evidence: [],
  recommendations: [],
  follow_up_question: null,
};

// n8n workflows sometimes wrap the payload (Agent node -> { output }, a Set/Code node -> { data }).
// Accept the bare object or one of these common wrappers before giving up.
export function unwrapAgentPayload(raw: unknown): unknown {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["output", "data", "json", "response", "result"]) {
      if (obj[key] && typeof obj[key] === "object") return obj[key];
    }
  }
  return raw;
}
