import { z } from "zod";

// The agent's structured output, standardized before it reaches the frontend
// (docs/AI_AGENT.md "Response schema"). WF-01 returns the model's raw text as
// `{ agent_output: "<string>" }`; this module coerces + validates it. On failure the
// route retries n8n once, then falls back — an unvalidated blob must never reach the UI
// (docs/SECURITY.md "AI output validation").

export const EvidenceItemSchema = z.object({
  type: z.enum(["customer_data", "knowledge_base"]).catch("customer_data"),
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

// Shape the frontend receives from POST /api/coach: the validated agent response,
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

/** Extract the first balanced `{...}` block from a string (handles prose/fences around it). */
function firstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const block = firstJsonObject(text);
    if (block && block !== text) {
      try {
        return JSON.parse(block);
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}

/**
 * Coerce whatever n8n returned into a candidate object for AgentResponseSchema:
 * unwrap `{ agent_output | output | data | ... }`, parse a JSON string (stripping code
 * fences / surrounding prose), and unwrap the case where the model nested the whole
 * object inside `answer` as a string.
 */
export function coerceAgentPayload(raw: unknown): unknown {
  let value: unknown = raw;

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["agent_output", "output", "data", "json", "response", "result"]) {
      if (key in obj) {
        value = obj[key];
        break;
      }
    }
  }

  if (typeof value === "string") {
    const cleaned = value
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    value = tryParse(cleaned);
  }

  // Model occasionally nests the real object inside `answer` as a JSON string.
  for (let guard = 0; guard < 3; guard += 1) {
    if (
      value &&
      typeof value === "object" &&
      typeof (value as Record<string, unknown>).answer === "string" &&
      ((value as Record<string, unknown>).answer as string).trim().startsWith("{")
    ) {
      const inner = tryParse(((value as Record<string, unknown>).answer as string).trim());
      if (inner && typeof inner === "object") {
        value = inner;
        continue;
      }
    }
    break;
  }

  return value;
}

/** coerce + validate; returns the AgentResponse or null. */
export function parseAgentResponse(raw: unknown): AgentResponse | null {
  const parsed = AgentResponseSchema.safeParse(coerceAgentPayload(raw));
  return parsed.success ? parsed.data : null;
}
