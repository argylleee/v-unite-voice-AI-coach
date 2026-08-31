# Migrating the n8n workflows to V-Unite's instance

Emman provided the real instance + LLM credit (2026-08-31):
- **n8n:** `https://primary-production-c0ce.up.railway.app` (self-hosted on Railway)
- **LLM:** a DeepSeek API key, **$2** budget. DeepSeek is OpenAI-API-compatible.
- Embeddings stay **Cohere `embed-english-v3.0`** (your own Cohere key — DeepSeek has no
  embeddings API, Emman didn't provide one).

Import files (in `n8n/workflows/`, generated from the dev instance):
`knowledge-search.json`, `wf-03-knowledge-ingestion.json`, `wf-01-chat-coach.json`.
`wf-01` already has the DeepSeek model node + `knowledge_search` tool baked in.

**Already pushed via the n8n public API (2026-08-31):** all 3 workflows now exist on the
Railway instance (credential references kept by name; nothing active yet):
- `WF-01 Chat Coach` → `wtkNL2SwbOcZTfGc`
- `WF-03 Knowledge Ingestion` → `JkcN37NRDhXC6ZAH`
- `knowledge_search` → `qKirMi1Liebzd3Oz` (WF-01's `knowledge_search` node already points here)

So skip §2 (import) — go straight to §1 (credentials), then §3–§6. Section §2 is kept for
reference / re-doing from scratch.

---

## 1. Register + create credentials

Register on the Railway n8n via Emman's invite link, then **Credentials → Add** — create these
**with these exact names** (import matches credentials by name):

| Name | Type | Values |
|---|---|---|
| `V-Unite Supabase` | Postgres | Host `aws-0-<region>.pooler.supabase.com`, Port `5432`, Database `postgres`, User `postgres.hhwkiimgjvdierjbjuxg`, Password = your Supabase DB password, **SSL: `Allow` / "Ignore SSL Issues"** |
| `V-Unite n8n Webhook Secret` | Header Auth | Name `Authorization`, Value `Bearer <pick a long random secret>` |
| `DeepSeek` | OpenAI | API Key = the DeepSeek key, **Base URL = `https://api.deepseek.com`** |
| `Cohere account` | Cohere | API Key = your Cohere key |

---

## 2. Import the workflows (order matters)

**Workflows → (⋯ menu) → Import from File**, in this order:

1. `knowledge-search.json`
2. `wf-03-knowledge-ingestion.json`
3. `wf-01-chat-coach.json`

After each import, for any node showing a credential warning, open it and pick the matching
credential from step 1 (usually auto-matched by name — just verify).

---

## 3. Fix the two things import can't carry

1. **WF-01 → `knowledge_search` node** — its Workflow field says
   `REPLACE_WITH_IMPORTED_knowledge_search_ID`. Open the node → set the Workflow selector
   to **From list** → pick **knowledge_search**.
2. **WF-01 → `DeepSeek Chat Model` node** — confirm Model = `deepseek-chat` (type it if it's
   not in the dropdown) and Credential = `DeepSeek`. Do **not** use `deepseek-reasoner` — it
   doesn't do tool-calling. The base URL lives on the `DeepSeek` credential, not the node.

---

## 4. Publish + collect URLs

Publish/activate in order: **knowledge_search → WF-03 → WF-01**.

Open each webhook node and copy its **Production URL**:
- WF-01 "Chat Webhook" → `https://primary-production-c0ce.up.railway.app/webhook/coach`
- WF-03 "Ingest Webhook" → `https://primary-production-c0ce.up.railway.app/webhook/knowledge`

---

## 5. Repoint the app

`.env.local` (and later Vercel):
```
N8N_CHAT_WEBHOOK_URL=https://primary-production-c0ce.up.railway.app/webhook/coach
N8N_KNOWLEDGE_WEBHOOK_URL=https://primary-production-c0ce.up.railway.app/webhook/knowledge
N8N_WEBHOOK_SECRET=<the secret from the Header Auth credential, WITHOUT "Bearer ">
```

---

## 6. Verify

Phase 3 (should already pass):
```powershell
$secret = "<your secret>"
"Which treatment needs attention?", "Which customers need follow-up?", "Where are rebooking rates weak?" | ForEach-Object {
  curl.exe -sS -X POST "https://primary-production-c0ce.up.railway.app/webhook/coach" `
    -H "Authorization: Bearer $secret" -H "Content-Type: application/json" `
    -d "{`"clinicId`":`"80a1c835-ed66-4c0c-8c3c-52c5e90fdbf4`",`"message`":`"$_`",`"mode`":`"chat`"}"
  "`n---"
}
```
Then Phase 4: attach Cohere cred to WF-03 "Cohere Embed" + TOOL "Embed Query" (import should
carry `Cohere account`; verify), upload a doc via `POST /api/knowledge`, check
`GET /api/knowledge?clinicId=...` shows `ready`, ask "What does our SOP say?", then the
grounding test (a policy you didn't upload → must refuse, not fabricate).

---

## Notes

- The old dev instance (`aldreisantua-n8n.duckdns.org`) can be left as-is or archived.
- Supabase, migrations, and the Next.js app don't change — only the n8n layer + webhook URLs.
- If Railway n8n gives you an API key (Settings → n8n API), paste results here and Claude Code
  can help debug via the API even though its MCP can't target this instance.

## Lessons from the first migration (2026-08-31)

- **Push workflows via the n8n UI "Import from File", not the public API.** The public API's
  create/update strips node params it treats as defaults — `mode` (Set), `resource` (Postgres),
  `inputSource` (Execute Workflow Trigger), `contentType` (HTTP) — which then breaks those nodes
  in the editor.
- **Credentials must be picked in the editor, per node.** Setting `credentials` by id via the
  API leaves a reference that fails the execution-time permission check ("does not have access
  to the credential"). Open each node, re-select its credential from the dropdown, save.
- **Sub-workflow tools can't be tested standalone** — `knowledge_search`'s trigger has no
  `query`/`clinicId` unless the agent (or the manual "Test workflow" input form) supplies them.
  The import JSON now has fallbacks (`$json.query || "test query"`, `clinicId || <demo clinic>`)
  so a bare run still succeeds. Real verification is via WF-01: ask it a knowledge question.
- On this instance `n8nVersion` is **2.35.3**; the predefined "Cohere API" credential type works
  fine on the HTTP Request node (a 400 "one of texts... must be specified" is a body problem,
  not auth).
