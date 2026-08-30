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

// The agent's response schema now lives in ./agent-response.ts (docs/AI_AGENT.md).
