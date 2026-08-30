"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  listDocuments,
  uploadDocument,
} from "@/lib/client/api";
import type { KnowledgeDocument } from "@/lib/validation/knowledge";
import { EmptyState, Notice, PageHeader, StatusTag } from "@/components/chart";

const ACCEPT = ".pdf,.txt";
const MAX_BYTES = 4 * 1024 * 1024;

export function KnowledgeView() {
  const [docs, setDocs] = useState<KnowledgeDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setDocs(await listDocuments());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load documents.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // poll while anything is still processing
  useEffect(() => {
    if (!docs?.some((d) => d.status === "processing")) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [docs, load]);

  const upload = useCallback(
    async (file: File) => {
      const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      if (ext !== ".pdf" && ext !== ".txt") {
        setError("Only PDF or TXT files can be added to the knowledge base.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError("That file is over the 4 MB limit.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await uploadDocument(file);
        await load();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "That upload was rejected.");
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  return (
    <div className="min-h-[100dvh]">
      <PageHeader
        title="Knowledge base"
        intro="Add the clinic’s own documents — SOPs, consultation scripts, pricing, policies. The coach retrieves from these and cites the source."
      />

      <div className="mx-auto max-w-[var(--measure)] space-y-6 px-5 py-6 md:px-8">
        {error ? <Notice title="Upload problem">{error}</Notice> : null}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) void upload(f);
          }}
          className={[
            "border border-dashed px-6 py-8 text-center transition-colors",
            dragging
              ? "border-[var(--accent)] bg-[var(--accent-soft)]"
              : "border-[var(--rule-strong)] bg-[var(--paper-raised)]",
          ].join(" ")}
        >
          <p className="text-sm text-[var(--ink)]">
            {busy ? "Uploading and processing…" : "Drop a PDF or TXT here"}
          </p>
          <p className="mt-1 text-xs text-[var(--ink-3)]">
            up to 4 MB · extracted, chunked, and embedded on upload
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="mt-3 rounded-[3px] border border-[var(--rule-strong)] bg-[var(--paper)] px-3 py-1.5 text-sm text-[var(--ink-2)] hover:border-[var(--accent)] hover:text-[var(--accent-ink)] disabled:opacity-40"
          >
            Choose file
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = "";
            }}
          />
        </div>

        <section className="border-t border-[var(--rule)] pt-4">
          <h3 className="record-label">Documents on file</h3>
          <div className="mt-3">
            {docs === null ? (
              <p className="text-sm text-[var(--ink-3)]">Loading…</p>
            ) : docs.length === 0 ? (
              <EmptyState title="No documents yet">
                Nothing has been uploaded. The coach will say so if you ask it a policy
                question before a document is added.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-[var(--rule)]">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[var(--ink)]">{d.filename}</p>
                      <p className="font-mono text-[0.7rem] text-[var(--ink-3)]">
                        {d.file_type.toUpperCase()} ·{" "}
                        {d.chunk_count} {d.chunk_count === 1 ? "chunk" : "chunks"} ·{" "}
                        {new Date(d.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusTag status={d.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
