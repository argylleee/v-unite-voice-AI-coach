// Server-side environment access. Never import this from a Client Component.
// These values must never reach the browser (docs/SECURITY.md).

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name} (see .env.example)`);
  }
  return value;
}

/** n8n chat webhook config. Read lazily so builds/tests don't need it set. */
export function n8nChatConfig(): { url: string; secret: string } {
  return {
    url: required("N8N_CHAT_WEBHOOK_URL"),
    secret: required("N8N_WEBHOOK_SECRET"),
  };
}

/** n8n knowledge-ingestion webhook config (WF-03). */
export function n8nKnowledgeConfig(): { url: string; secret: string } {
  return {
    url: required("N8N_KNOWLEDGE_WEBHOOK_URL"),
    secret: required("N8N_WEBHOOK_SECRET"),
  };
}

/** n8n voice-coach webhook config (WF-02). */
export function n8nVoiceConfig(): { url: string; secret: string } {
  return {
    url: required("N8N_VOICE_WEBHOOK_URL"),
    secret: required("N8N_WEBHOOK_SECRET"),
  };
}

/** n8n session-summary webhook config (WF-04). */
export function n8nSummaryConfig(): { url: string; secret: string } {
  return {
    url: required("N8N_SUMMARY_WEBHOOK_URL"),
    secret: required("N8N_WEBHOOK_SECRET"),
  };
}
