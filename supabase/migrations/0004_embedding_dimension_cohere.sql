-- 0004_embedding_dimension_cohere.sql
-- Phase 4 (RAG): the embedding model is Cohere embed-english-v3.0 -> 1024 dimensions.
-- 0002 used a 1536 placeholder (docs/DATABASE.md said to set the real value before the first
-- ingestion run). Nothing has been ingested yet, so this is a safe, one-time change:
-- drop the ANN index, resize the column, recreate the index, recreate the RPC at the new dim.

drop index if exists knowledge_chunks_embedding_idx;

alter table knowledge_chunks
    alter column embedding type extensions.vector(1024);

create index if not exists knowledge_chunks_embedding_idx
    on knowledge_chunks
    using hnsw (embedding extensions.vector_cosine_ops);

-- The argument type changes, so replace rather than create-or-replace (a different signature
-- would otherwise create a second overload).
drop function if exists match_knowledge_chunks(extensions.vector, uuid, int, float);

create function match_knowledge_chunks (
    query_embedding extensions.vector(1024),
    match_clinic_id uuid,
    match_count int default 5,
    match_threshold float default 0.5
)
returns table (
    id uuid,
    document_id uuid,
    content text,
    metadata jsonb,
    similarity float
)
language sql stable
as $$
    select
        knowledge_chunks.id,
        knowledge_chunks.document_id,
        knowledge_chunks.content,
        knowledge_chunks.metadata,
        1 - (knowledge_chunks.embedding <=> query_embedding) as similarity
    from knowledge_chunks
    where knowledge_chunks.clinic_id = match_clinic_id
      and 1 - (knowledge_chunks.embedding <=> query_embedding) > match_threshold
    order by knowledge_chunks.embedding <=> query_embedding asc
    limit least(match_count, 20);
$$;
