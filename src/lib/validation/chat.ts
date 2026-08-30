import { z } from "zod";

// Boundary schema for a coaching request coming from the browser into the Next.js API route.
// docs/SECURITY.md: validate every external input with Zod before it reaches orchestration.
export const ChatRequestSchema = z.object({
  clinicId: z.string().uuid(),
  message: z.string().min(1).max(5000),
  mode: z.enum(["chat", "voice"]).default("chat"),
  // Sessions are Phase 7; accepted now so the request shape is forward-compatible.
  sessionId: z.string().uuid().optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// Shape the n8n webhook returns in Phase 2 (no LLM yet — a DB-derived echo).
// Phase 3 replaces this with the validated AI Agent response (docs/AI_AGENT.md).
export const N8nSkeletonResponseSchema = z.object({
  ok: z.boolean(),
  clinicId: z.string().nullish(),
  echo: z.string().nullish(),
  data: z
    .object({
      customerCount: z.number(),
      treatments: z.array(z.record(z.unknown())),
    })
    .nullish(),
  meta: z.record(z.unknown()).nullish(),
  error: z.string().nullish(),
});

export type N8nSkeletonResponse = z.infer<typeof N8nSkeletonResponseSchema>;
