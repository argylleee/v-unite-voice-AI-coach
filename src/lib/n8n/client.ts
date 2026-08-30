// Server-side helper for calling n8n webhooks. Every call carries the bearer secret
// (docs/SECURITY.md). Next.js never talks to the LLM or Supabase directly — it forwards
// to n8n and renders the result (docs/ARCHITECTURE.md).

export class N8nError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "N8nError";
  }
}

export interface CallN8nOptions {
  url: string;
  secret: string;
  payload: unknown;
  timeoutMs?: number;
}

/** POST JSON to an n8n webhook and return its parsed JSON response. Throws N8nError on failure. */
export async function callN8nWebhook<T = unknown>({
  url,
  secret,
  payload,
  timeoutMs = 20_000,
}: CallN8nOptions): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (err) {
    throw new N8nError(
      `n8n request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new N8nError(`n8n returned non-JSON response (status ${res.status})`, res.status, text);
  }

  if (!res.ok) {
    throw new N8nError(`n8n returned status ${res.status}`, res.status, json);
  }

  return json as T;
}
