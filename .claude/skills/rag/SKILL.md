---
name: rag
description: Use when implementing document upload, chunking, embeddings, or vector retrieval for the clinic knowledge base.
---

# RAG

Read `docs/RAG.md` and `docs/DATABASE.md` (pgvector setup) first.

## Rules

- Supported uploads: PDF and TXT only. Reject everything else explicitly.
- Pipeline: validate -> store document metadata -> extract text -> clean -> chunk (~500-800
  tokens, ~50-100 overlap) -> embed -> store in `knowledge_chunks` -> mark ready.
- Retrieval goes through the `match_knowledge_chunks` Postgres RPC (not a hand-rolled query) —
  see `docs/DATABASE.md` for why (the HNSW index + RPC pattern is what makes retrieval both fast
  and simple to call from n8n).
- Retrieve a small number of high-quality chunks (3-5); never pass a whole document to the LLM.
- Return document name + similarity score with every retrieved chunk so the UI can cite sources.
- If retrieval is empty or below threshold, the tool must return a structured "no evidence found"
  result — never let the agent fabricate an answer to cover the gap.
- Test: ingestion (PDF and TXT), chunking, embedding storage, relevant retrieval, irrelevant
  query, empty retrieval, source metadata, and a prompt-injection string embedded in a document
  (must be treated as inert content).
