# Phase 4 — RAG (n8n build guide)

You build these by hand in the n8n editor. Claude Code delivered the Next.js side:
`POST /api/knowledge` (upload → validate → forward file) and `GET /api/knowledge` (list +
status), plus migration `0004` (embedding column is now `vector(1024)` for Cohere
`embed-english-v3.0`).

Two things to build:
1. **WF-03 Knowledge Ingestion** — new workflow, webhook that ingests one file.
2. **TOOL-knowledge_search** — new sub-workflow, wired onto WF-01's agent as a tool.

Embedding model: **Cohere `embed-english-v3.0`**, 1024 dims. `input_type` matters:
`search_document` when embedding chunks (ingestion), `search_query` when embedding the
question (retrieval). Getting this wrong quietly tanks recall.

---

## 0. Prereqs

- Cohere credential exists on the instance ("Cohere account", type `cohereApi`).
- Postgres credential "V-Unite Supabase" exists (SSL = ignore-issues).
- Decide the ingestion webhook path: `knowledge` →
  `https://aldreisantua-n8n.duckdns.org/webhook/knowledge`. Put that in `.env.local` as
  `N8N_KNOWLEDGE_WEBHOOK_URL` (and later Vercel).

---

## 1. WF-03 — Knowledge Ingestion

New workflow. Trigger: **Webhook** (`n8n-nodes-base.webhook`, v2.1)
- HTTP Method POST, Path `knowledge`
- Authentication: **Header Auth** → reuse the "V-Unite n8n Webhook Secret" credential
- Response Mode: **Using 'Respond to Webhook' node**
- Options → **Raw Body / Binary Data: ON** (the file arrives as multipart form-data; fields:
  `file` (binary), `clinicId`, `filename`, `fileType`)

### Flow

```
Webhook
  → Set "Normalize"            (clinicId, filename, fileType from the form fields)
  → Postgres "Insert Document" (knowledge_documents, status='processing', RETURNING id)
  → Switch on fileType
       ├─ pdf → Extract from File (operation: PDF)
       └─ txt → Extract from File (operation: Text)
  → Code "Chunk"               (clean + split into ~2000-char chunks, ~300 overlap)
  → HTTP Request "Cohere Embed" (input_type: search_document, texts: [all chunk contents])
  → Code "Zip Embeddings"      (attach each vector to its chunk as a pgvector literal)
  → Postgres "Insert Chunks"   (knowledge_chunks, one row per chunk)
  → Postgres "Mark Ready"      (knowledge_documents.status='ready')
  → Respond Success            ({ ok:true, documentId, chunks:N, status:'ready' })

  any failure → Postgres "Mark Failed" (status='failed') → Respond Error (502)
```

### Node detail

**Set "Normalize"** — assignments (string):
- `clinicId`  = `{{ $json.body.clinicId }}`
- `filename`  = `{{ $json.body.filename }}`
- `fileType`  = `{{ $json.body.fileType }}`

**Postgres "Insert Document"** — Operation *Execute Query*:
```sql
insert into knowledge_documents (clinic_id, filename, file_type, status)
values ($1, $2, $3, 'processing')
returning id
```
Query Parameters: `{{ $json.clinicId }}, {{ $json.filename }}, {{ $json.fileType }}`

**Switch** (`n8n-nodes-base.switch`, Rules mode) on `{{ $('Normalize').item.json.fileType }}`
— case `pdf` → output 0, case `txt` → output 1.

**Extract from File** (`n8n-nodes-base.extractFromFile`, v1.1)
- PDF branch: Operation **PDF**, Input Binary Field `file`
- TXT branch: Operation **Text**, Input Binary Field `file`
- Both put the text on `{{ $json.text }}` (PDF) / `{{ $json.data }}` (text) — check the node
  output and use whichever key it emits.

**Code "Chunk"** — Mode *Run Once for All Items*, JavaScript:
```js
const src = $input.first().json;
const raw = (src.text || src.data || src.content || '').toString();
const clean = raw.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
if (!clean) { throw new Error('no_text_extracted'); }

const SIZE = 2000;      // ~500 tokens
const OVERLAP = 300;
const chunks = [];
let i = 0;
while (i < clean.length) {
  const piece = clean.slice(i, i + SIZE).trim();
  if (piece) chunks.push(piece);
  i += SIZE - OVERLAP;
}
return chunks.map((content, idx) => ({ json: { content, chunk_index: idx } }));
```

**HTTP Request "Cohere Embed"** (`n8n-nodes-base.httpRequest`)
- Method POST, URL `https://api.cohere.com/v2/embed`
- Authentication: **Predefined Credential Type → Cohere API** (credential "Cohere account").
  If that option isn't offered, make a Header Auth credential
  (`Authorization: Bearer <COHERE_API_KEY>`) and use it here.
- Send Body: ON, Body Content Type: JSON, **Specify Body: Using JSON**:
  ```
  {
    "model": "embed-english-v3.0",
    "input_type": "search_document",
    "embedding_types": ["float"],
    "texts": {{ JSON.stringify($input.all().map(i => i.json.content)) }}
  }
  ```
- `executeOnce: ON` (one call for all chunks — Cohere takes up to 96 texts per call; clinic
  docs are well under that. If a doc ever exceeds 96 chunks, add a Loop Over Items batching by
  90 before this node.)
- Response comes back as `{{ $json.embeddings.float }}` — an array of 1024-length arrays,
  index-aligned with the `texts` you sent.

**Code "Zip Embeddings"** — Mode *Run Once for All Items*:
```js
const vectors = $json.embeddings.float;                 // from the HTTP node
const chunks = $('Chunk').all().map(i => i.json);       // [{content, chunk_index}]
if (!Array.isArray(vectors) || vectors.length !== chunks.length) {
  throw new Error('embedding_count_mismatch: ' + (vectors ? vectors.length : 'none') + ' vs ' + chunks.length);
}
const docId = $('Insert Document').first().json.id;
const clinicId = $('Normalize').first().json.clinicId;
const filename = $('Normalize').first().json.filename;
return chunks.map((c, idx) => ({
  json: {
    document_id: docId,
    clinic_id: clinicId,
    content: c.content,
    chunk_index: c.chunk_index,
    embedding: '[' + vectors[idx].join(',') + ']',       // pgvector literal
    metadata: JSON.stringify({ source: filename, chunk_index: c.chunk_index }),
  },
}));
```

**Postgres "Insert Chunks"** — Operation *Execute Query*, runs once per item:
```sql
insert into knowledge_chunks (document_id, clinic_id, content, chunk_index, embedding, metadata)
values ($1, $2, $3, $4, $5::vector, $6::jsonb)
```
Query Parameters:
`{{ $json.document_id }}, {{ $json.clinic_id }}, {{ $json.content }}, {{ $json.chunk_index }}, {{ $json.embedding }}, {{ $json.metadata }}`

**Postgres "Mark Ready"** — Execute Query:
```sql
update knowledge_documents set status = 'ready' where id = $1
```
Param: `{{ $('Insert Document').first().json.id }}`

**Respond Success** — Respond to Webhook, JSON, 200:
```
{{ { "ok": true, "documentId": $('Insert Document').first().json.id, "chunks": $('Chunk').all().length, "status": "ready" } }}
```

**Error path** — on the Insert Document / Extract / Cohere / Insert Chunks nodes set
**On Error → Continue (using error output)** and route each error output to:
- Postgres "Mark Failed": `update knowledge_documents set status='failed' where id = $1`
  (param `{{ $('Insert Document').first().json.id }}` — guard: only if that node ran)
- Respond Error: JSON `{{ { "ok": false, "error": "ingestion_failed" } }}`, code 502

---

## 2. TOOL-knowledge_search — sub-workflow + wire onto WF-01

New workflow. Trigger: **Execute Workflow Trigger** (`n8n-nodes-base.executeWorkflowTrigger`,
v1.2) — define **Workflow Input Schema**: `query` (string), `clinicId` (string).

### Flow

```
Execute Workflow Trigger
  → HTTP Request "Cohere Embed Query" (input_type: search_query, texts: [ {{ $json.query }} ])
  → Set "Vector Literal"  (embeddingLiteral = '[' + join(',') + ']')
  → Postgres "Match Chunks" (calls match_knowledge_chunks)
  → Code "Shape"          ({ found, chunks:[{source, content, similarity}] })
```

**HTTP Request "Cohere Embed Query"** — same as ingestion but:
```
{
  "model": "embed-english-v3.0",
  "input_type": "search_query",
  "embedding_types": ["float"],
  "texts": [ {{ JSON.stringify($json.query) }} ]
}
```

**Set "Vector Literal"** — string assignment
`embeddingLiteral` = `{{ '[' + $json.embeddings.float[0].join(',') + ']' }}`

**Postgres "Match Chunks"** — Execute Query:
```sql
select d.filename as source,
       m.content,
       round(m.similarity::numeric, 3) as similarity
from match_knowledge_chunks($1::vector, $2::uuid, 5, 0.5) m
join knowledge_documents d on d.id = m.document_id
order by m.similarity desc
```
Query Parameters:
`{{ $('Vector Literal').item.json.embeddingLiteral }}, {{ $('Execute Workflow Trigger').item.json.clinicId }}`

**Code "Shape"** — Run Once for All Items:
```js
const rows = $input.all().map(i => i.json).filter(r => r && r.content);
if (rows.length === 0) {
  return [{ json: { found: 0, chunks: [], note: 'No matching content in the clinic knowledge base.' } }];
}
return [{ json: {
  found: rows.length,
  chunks: rows.map(r => ({ source: r.source, content: r.content, similarity: Number(r.similarity) })),
} }];
```

### Wire onto WF-01

Add a **Call n8n Workflow Tool** node (`@n8n/n8n-nodes-langchain.toolWorkflow`, v2.2),
connect its `ai_tool` output to the **AI Coach Agent**.
- Workflow: select **TOOL-knowledge_search**
- Name the tool `knowledge_search`
- Tool description:
  > Searches the clinic's uploaded knowledge base (policies, SOPs, scripts, pricing docs) for
  > passages relevant to a question. Returns up to 5 excerpts with their source document name
  > and similarity. Use for "what does our policy/SOP/script say", NOT for numeric metrics.
- Workflow Inputs:
  - `query`    = `{{ $fromAI('query', 'The clinic-knowledge question to look up, e.g. "cancellation policy" or "CoolSculpting consultation script"', 'string') }}`
  - `clinicId` = `{{ $('Normalize Request').first().json.clinicId }}`   ← fixed, never `$fromAI`

### Update WF-01's system message

Add these lines to the AI Coach Agent's System Message (under the tools list):

```
  - knowledge_search: the clinic's uploaded documents (policies, SOPs, scripts, pricing).
    Use for "what does our <policy/SOP/script> say". It returns excerpts with a source
    document name — cite that source in your evidence.

SQL vs. knowledge base:
- Numbers about customers/treatments/conversion/rebooking/spend -> customer_analytics /
  customer_lookup / kpi_calculator. NEVER answer those from knowledge_search.
- Questions about what a document says -> knowledge_search.
- A question that needs both (e.g. "conversion is low, what does our SOP recommend") ->
  call both, then reason over the combined evidence.
- If knowledge_search returns found: 0, say the knowledge base doesn't cover it. Do not
  invent a policy, price, or procedure.
```

And extend the Structured Output Parser example so it shows a knowledge_base evidence item:

```json
{
  "answer": "Your SOP says consultations should end with a specific next-step booking...",
  "insights": ["The SOP is explicit about booking before the client leaves; that step may be getting skipped for CoolSculpting."],
  "evidence": [
    { "type": "customer_data", "description": "CoolSculpting conversion 27.6% vs ~65% others", "source": null },
    { "type": "knowledge_base", "description": "Consultation SOP: 'always schedule the follow-up before the client leaves the room'", "source": "Consultation SOP.pdf" }
  ],
  "recommendations": ["Re-train CoolSculpting consult staff on the SOP's closing step."],
  "follow_up_question": "Do you want the exact SOP wording to share with the team?"
}
```

---

## 3. Verify

1. `.env.local` → `N8N_KNOWLEDGE_WEBHOOK_URL=https://aldreisantua-n8n.duckdns.org/webhook/knowledge`,
   both WF-03 and TOOL-knowledge_search **published**, `knowledge_search` wired onto WF-01
   (also republish WF-01).
2. Upload a doc — from the app once the UI exists, or:
   ```powershell
   $secret = "vUnite@2026"
   curl.exe -sS -X POST "https://aldreisantua-n8n.duckdns.org/webhook/knowledge" `
     -H "Authorization: Bearer $secret" `
     -F "clinicId=80a1c835-ed66-4c0c-8c3c-52c5e90fdbf4" `
     -F "filename=Consultation SOP.txt" -F "fileType=txt" `
     -F "file=@C:\path\to\sop.txt;type=text/plain"
   ```
   Expect `{ "ok": true, "documentId": "...", "chunks": N, "status": "ready" }`.
3. `GET http://localhost:3000/api/knowledge?clinicId=80a1c835-...` → the doc shows
   `status: "ready"` with `chunk_count` > 0.
4. Ask WF-01 (via `/webhook/coach` or `/api/coach`): **"What does our consultation SOP say?"**
   → answer quotes the doc, `evidence` has a `knowledge_base` item with
   `source: "Consultation SOP.txt"`.
5. **Grounding check** (this is the required failure test, `docs/TESTING.md`): ask about a
   policy you did NOT upload, e.g. "What is our refund policy?" → the agent must say the
   knowledge base doesn't contain it, NOT invent one.

---

## 4. Watch-outs

- `input_type` must be `search_document` at ingestion and `search_query` at retrieval — same
  model, different embedding space alignment.
- `clinicId` into `knowledge_search` is a fixed expression, never `$fromAI` (cross-clinic leak).
- The Cohere v2 response path is `embeddings.float`. If your n8n Cohere setup hits the v1
  endpoint (`https://api.cohere.ai/v1/embed`) instead, the path is just `embeddings` (array).
- `match_threshold` is 0.5. If good docs aren't matching, lower it to 0.3 in the SQL call and
  re-test before assuming ingestion is broken.
- After changing WF-01's system message or adding the tool, **republish WF-01** — the live
  `/webhook/coach` serves the published version, not your draft.
