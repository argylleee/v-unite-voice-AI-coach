Non-UI logic: `supabase/` (server-side client only), `n8n/` (webhook-calling helpers), `fish-audio/`
(not called directly from here in production — voice goes through n8n; useful for local testing
scripts only), `validation/` (Zod schemas shared between API routes and tests).
