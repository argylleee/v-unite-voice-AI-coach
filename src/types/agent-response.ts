// Shared agent-response types. Derived from the Zod schema so the two never drift
// (docs/AI_AGENT.md, src/types/README.md).
export type {
  AgentResponse,
  EvidenceItem,
  CoachApiResponse,
} from "@/lib/validation/agent-response";
