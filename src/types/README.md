Shared TypeScript types: customer.ts, session.ts, message.ts, knowledge.ts, agent-response.ts
(mirrors the Zod schema in docs/AI_AGENT.md — keep these in sync, ideally derive the type from
the schema with z.infer rather than maintaining both by hand).
