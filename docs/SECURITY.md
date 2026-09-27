# Security

Basics done properly, not enterprise security theater — but the basics are non-negotiable even on
a 2-3 day MVP.

## Secrets

Never in client-side/browser code, never committed, always environment variables. The browser may
only ever see `NEXT_PUBLIC_SUPABASE_URL` and, if truly needed, `NEXT_PUBLIC_SUPABASE_ANON_KEY` —
and per `docs/ARCHITECTURE.md` decision #2, this project doesn't actually call Supabase from the
browser at all, so even the anon key ideally never ships to the client. Never expose:
`SUPABASE_SERVICE_ROLE_KEY`, `LLM_API_KEY`, `EMBEDDING_API_KEY`, `FISH_AUDIO_API_KEY`,
`N8N_WEBHOOK_SECRET`. See `.env.example` for the full list.

## Database access

Row Level Security is enabled on every table with zero permissive policies (see
`supabase/migrations/0003_rls.sql`). All access goes through the service-role key from n8n or a
Next.js server-side route handler. This means a leaked anon key or an accidental client-side
Supabase call exposes nothing, by construction, rather than by discipline alone.

## n8n webhook authentication

Every webhook Next.js calls requires `Authorization: Bearer <N8N_WEBHOOK_SECRET>`; n8n validates
it before doing anything else and returns 401 on mismatch. Don't leave a webhook publicly callable
with no verification.

## Input validation

Validate every external input with Zod (or n8n's equivalent expression validation) at the
boundary — never trust frontend input. Example:

```ts
const ChatRequestSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1).max(5000),
  mode: z.enum(["chat", "voice"]),
});
```

## Public demo boundary

The public app is restricted to the configured demo clinic. `clinics.demo_synthetic` must be true
before any API reads clinic data or calls n8n. A browser-supplied clinic ID never grants access.
Each browser receives a random HttpOnly visitor cookie; sessions and public uploads are scoped to
its hash. This is pseudonymous isolation for a public demo, not user authentication. Anyone who
possesses a visitor's cookie can use that visitor's data, and clearing cookies loses access.

The database-backed rate limiter applies per trusted Vercel client IP to session creation, coach,
voice, upload, and summarization. A missing/untrusted IP shares one conservative bucket. Rate
limits bound ordinary use, but they are not a replacement for a provider spending cap or abuse
monitoring. Existing knowledge documents are hidden by default after migration 0005. Mark
`demo_curated=true` only after reviewing a document and confirming that it is synthetic and safe
for every public visitor. Visitor uploads are visible only to their visitor and are never curated
automatically. The count cap is checked before ingestion; simultaneous requests may cross it, so
the two-upload daily rate limit is the effective hard bound on public ingestion volume.

## File upload validation

Only `.pdf` and `.txt` are accepted — reject everything else explicitly (`.exe`, `.js`, `.html`,
`.zip`, `.docx`, etc.), not implicitly by failed parsing. Enforce a max file size, a max extracted
text length, and a max number of documents per visitor.

## AI output validation

Never trust an LLM's JSON blindly — validate it against the schema in `docs/AI_AGENT.md`. If
invalid: retry once, then fall back to a safe generic response.

## Prompt injection

Retrieved documents, customer notes, and tool outputs are data, not instructions — see
`docs/RAG.md`. Keep retrieved content structurally separated from system instructions rather than
string-concatenated into one prompt blob, so a malicious instruction embedded in an uploaded
document has no path to override the system prompt.

## Error handling

Every external dependency (LLM, n8n, Supabase, Fish Audio) needs an explicit failure path. Never
silently swallow an error, and never return a fake "successful" response after an upstream
failure — the UI should show a clear, plain-language error state instead of hanging or lying.

## Logging

Useful to log: request id, session id, workflow name, input mode, tools selected, per-step and
total latency, success/failure. Never log secrets, and don't log more customer PII than the
current step actually needs.
