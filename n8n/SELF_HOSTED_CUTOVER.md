# Cut over from Railway n8n to the owner-operated instance

Target editor and webhook host: `https://aldreisantua-n8n.duckdns.org` (confirmed by the owner).
The live host is the Google Cloud VM `n8n-server` (`us-west1-a`), running n8n and Caddy in
Docker Compose at `/home/n8n-oci/n8n-stack`. It is independent of Docker Desktop on this
Windows PC. After host maintenance on 2026-09-27, an external Cloud Shell request to public
`/healthz/readiness` returned HTTP 200. This proves network and database readiness, **not**
that workflows, credentials, or webhook executions work. See [host maintenance](HOST_STABILITY.md)
for the backup location, settings, and remaining uptime risks before changing Vercel.

## Inventory before change

1. Back up the owner-operated n8n database and encryption key. Record its n8n version and whether
   it uses SQLite or Postgres; do not export credential plaintext into this repository.
2. In the editor, list existing workflows and active webhook paths `coach`, `voice`, `knowledge`,
   and `summary`. Importing a duplicate active webhook path can conflict with an existing workflow.
3. Compare existing workflow IDs with the IDs referenced by WF-01's `knowledge_search` tool and
   WF-02's coach call. Rebind the tool to the imported `knowledge_search` in the editor.
4. Check these named credentials in the editor and reselect them on each imported node:
   `V-Unite Supabase`, `V-Unite n8n Webhook Secret`, `Groq account`, `Cohere account`,
   `Cohere Header`, `Groq account`, and `Fish Audio`. The JSON exports contain credential
   references, not usable secret material.

## Local changes prepared

The six JSON exports in `n8n/workflows/` are the reviewed source for the new host. The local
WF-02 export calls `http://127.0.0.1:5678/webhook/coach` from inside the same n8n container;
this avoids sending its nested coach request through the VM's public DuckDNS address. WF-01 passes a visitor
hash to `knowledge_search`; WF-03 stores it. This contract requires database migration
`supabase/migrations/0005_public_demo_guardrails.sql` before these workflows are active.

## Fast repair for workflows already imported

Migration 0005 has been applied to the live Supabase database. The search function now accepts
the five arguments used by `knowledge_search`. Existing documents are intentionally hidden from
the public demo until reviewed and marked `demo_curated=true`.

On 2026-09-28, a read-only comparison found all 100 customer rows in the configured demo clinic
exactly matched the deterministic seed. Its three existing documents were uncurated and its 33
older sessions had no visitor owner, so the new public routes do not expose them. The clinic's
`demo_synthetic` flag was then enabled. After the GitHub deployment passed, production
`/api/knowledge` and `/api/sessions` each returned HTTP 200 with zero visible legacy records.
A short production coach greeting returned HTTP 200, but a cancellation-policy question returned
HTTP 502 twice while the same question sent directly to the DuckDNS WF-01 returned HTTP 200.
The later Vercel request trace confirmed its outbound POST reached the DuckDNS `/webhook/coach`
endpoint. The failure was inside WF-01; see the diagnosis below.

For the already imported workflows, edit these nodes in the n8n editor and publish both workflows:

1. In **WF-01 Chat Coach → AI Coach Agent**, set **Max Iterations** to `4`. In its system message,
   tell the agent: `If knowledge_search returns found: 0, stop using tools and say no approved
   document is available in this public demo. Do not infer that the clinic has no policy. Use
   evidence: [] for this case.` The local WF-01 JSON contains the full revised system message
   and current Groq Qwen model selection for comparison.
2. In **WF-02 Voice Coach → Call Chat Coach (WF-01)**, set URL to
   `http://127.0.0.1:5678/webhook/coach`. Keep the bearer credential. This URL is only for the
   call made inside the n8n container; Vercel must continue to use the public HTTPS URL.
3. Test one chat policy question and one short voice question, one at a time. A policy answer
   without an approved document should report no approved source and cite no invented policy.
   The voice run should pass through WF-02's internal coach call and return audio.

On 2026-09-27, direct inspection of the live n8n database confirmed WF-01's **published**
version had Max Iterations `4` and a `Groq Chat Model`
(`openai/gpt-oss-120b`). Its `knowledge_search` tool points to published workflow
`duB1yVr68EZDtyJt`. An additional unpublished draft exists for that search workflow and
there are duplicate inactive search workflows; do not edit the wrong copy. A correctly
encoded synthetic request to `/webhook/coach` returned HTTP 200 in 4.18 seconds for
"What is our cancellation policy?" but HTTP 502 with `agent_error` in 3.95 seconds for the
same conversation's follow-up, "Can you help draft a cancellation policy template?".
Thus the follow-up failure was reproducible in the **WF-01 AI Coach Agent error branch**;
the underlying model/tool error was not exposed in the public response. WF-02's coach HTTP node was then changed in the live
editor to `http://127.0.0.1:5678/webhook/coach` and published as **Internal coach routing**.
An independent read of the published workflow version confirmed that exact URL. Voice
latency and audio output still require a live voice test.

The WF-01 live prompt initially contained contradictory evidence instructions. Its published
version was corrected to allow `evidence: []` when no approved document is found, and to
answer requests for a new policy template with an unapproved outline and placeholders instead
of another knowledge search. The matching source export was updated. A production follow-up
still returned `agent_error` immediately after publishing, while the same prompt succeeded in
the editor's full agent-node test. Restarting only the n8n container reactivated the published
WF-01 and WF-02 versions; readiness returned to HTTP 200, and the exact production follow-up
then returned HTTP 200 in 6.98 seconds. The restart result supports stale active runtime state
as a contributing cause, but the specific internal `agent_error` was not captured. Keep
monitoring this path, especially after future publishes.

On 2026-09-28, successful production execution capture was enabled temporarily on WF-01.
Execution #903 showed `knowledge_search` returned `found: 0`, then Groq rejected the next
`openai/gpt-oss-120b` response: `attempted to call tool 'json' which was not in request.tools`.
This caused the WF-01 `Respond Agent Error` branch and Vercel HTTP 502. The live Groq Chat
Model was changed to `qwen/qwen3.8-27b` and published as **Groq Qwen tool-call fix**. A
synthetic policy question and policy-template follow-up each returned HTTP 200 through the
deployed Vercel `/api/coach`, in about 14 and 7 seconds respectively. WF-01's successful
production execution retention was restored to **Default - Do not save** after diagnosis.
The local WF-01 export now matches the live model type and selection. This verifies the
chat path for those two prompts.

A synthetic WAV sent through the deployed `/api/voice` reached WF-02 execution #911. Groq
Whisper transcribed it, WF-01 answered, and Fish Audio TTS returned `401 Invalid Token`.
The live **Fish Audio TTS** node had selected `V-Unite n8n Webhook Secret` as its Header Auth
credential. The n8n credential picker showed no Fish Audio Header Auth credential, despite
the local WF-02 export referring to one. Create a separate Header Auth credential named
`Fish Audio`, with header name `Authorization` and value `Bearer <Fish Audio API key>`, then
select it on the TTS node and publish WF-02. Never reuse the n8n webhook secret for Fish.
The exported JSON contains only a credential reference; importing it does not import its key.
Retest `/api/voice` and confirm the response includes transcript, answer, and audio before
considering voice restored. WF-02 temporarily saves successful production executions for
diagnosis; restore its setting to **Default - Do not save** after the voice retest.

The VM's Compose environment has `EXECUTIONS_DATA_SAVE_ON_SUCCESS=none`, so successful runs
do not appear in the execution history. A run that vanishes after stopping is not evidence that
the user deleted it; the exact fate of a stopped run needs host logs or the workflow's execution
settings. The same VM has `N8N_CONCURRENCY_PRODUCTION_LIMIT=2`, so test sequentially while
diagnosing latency.

## Import and validation order

1. Apply migration 0005 after backing up Supabase and confirming that the public demo clinic
   contains synthetic data only. Existing knowledge documents remain hidden until explicitly
   reviewed and marked `demo_curated=true`.
2. Import `knowledge_search.json`, then `WF-01 Chat Coach.json`, `WF-02 Voice Coach.json`,
   `WF-03 Knowledge Ingestion.json`, `WF-04 Session Summary.json`, and
   `WF-05 Error Handler.json`. Rebind all credentials and the WF-01 sub-workflow selector.
   Preserve any existing workflows until the replacement paths are verified.
3. Test with synthetic data in n8n before publishing webhooks. Require a valid grounded coach
   answer, a voice turn, a ready private knowledge upload, and a session summary. Inspect the
   first failing node of WF-01 if the agent still takes its `agent_error` branch.
4. Publish the replacement workflows and verify each production webhook URL on the DuckDNS host.
   Keep the same bearer secret in n8n and Vercel, or rotate both together.
5. Update Vercel Production environment variables `N8N_CHAT_WEBHOOK_URL`,
   `N8N_VOICE_WEBHOOK_URL`, `N8N_KNOWLEDGE_WEBHOOK_URL`, and `N8N_SUMMARY_WEBHOOK_URL` to the
   DuckDNS `/webhook/<path>` URLs. Deploy the already tested app through the CI gate.
6. Smoke-test the deployed Vercel site with a fresh visitor: coach, voice, upload, summary,
   and another visitor's 404 on the first visitor's session. Check n8n execution records and
   Vercel function logs for each run. Retain the old Railway settings until rollback is no
   longer needed; do not depend on Railway being accessible.

Do not point Vercel to `localhost:5678`: its functions run away from this computer and need the
public HTTPS address. Keep the editor authenticated and the webhook bearer secret enabled.
