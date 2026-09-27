"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, listDocuments, uploadDocument } from "@/lib/client/api";
import type { KnowledgeDocument } from "@/lib/validation/knowledge";
import {
  Alert,
  Badge,
  BTN_PRIMARY,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  GUTTER,
  PageHeader,
} from "@/components/chart";
import { SkeletonList } from "@/components/skeleton";

const ACCEPT = ".pdf,.txt";
const MAX_BYTES = 4 * 1024 * 1024;

function DocIcon() {
  return (
    <svg fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

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

  const readyCount = docs?.filter((d) => d.status === "ready").length ?? 0;
  const totalChunks = docs?.reduce((sum, d) => sum + d.chunk_count, 0) ?? 0;

  return (
    <div className="min-h-[100dvh]">
      <PageHeader
        title="Knowledge"
        subtitle="Your clinic's own documents — SOPs, scripts, pricing, policies. The coach retrieves from these and cites the passage it used."
        actions={
          <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className={BTN_PRIMARY}>
            {busy ? "Uploading…" : "Add document"}
          </button>
        }
        meta={
          docs && docs.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[0.7rem] tracking-[0.08em] uppercase">
              <span className="text-ink-3">
                <span className="text-ink">{readyCount}</span> ready
              </span>
              <span className="h-3 w-px bg-line-2" />
              <span className="text-ink-3">
                <span className="text-ink">{totalChunks}</span> chunks
              </span>
              <span className="h-3 w-px bg-line-2" />
              <span className="text-ink-3">
                <span className="text-ink">{docs.length}</span> on file
              </span>
            </div>
          ) : null
        }
      />

      <div className={`${GUTTER} py-7 md:py-9`}>
        <div className="mx-auto max-w-4xl">
          {error ? (
            <div className="mb-5">
              <Alert type="error" title="Upload problem">
                {error}
              </Alert>
            </div>
          ) : null}

          {/* Drop zone */}
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
              "relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed px-6 py-11 text-center transition-all duration-200",
              dragging
                ? "border-brand bg-brand-soft"
                : "border-line-2 bg-surface hover:border-brand/50",
            ].join(" ")}
          >
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-brand-soft text-brand">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
            </div>
            <p className="font-display text-[1.1rem] font-semibold text-ink">
              {busy ? "Uploading and processing…" : "Drop a PDF or TXT here"}
            </p>
            <p className="mt-1.5 text-[0.85rem] text-ink-3">
              Up to 4 MB · extracted, chunked and embedded on upload
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2 text-[0.85rem] font-medium text-ink-2 transition-all hover:bg-brand-soft hover:text-brand active:scale-[0.97]"
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

          {/* Document list */}
          <div className="mt-7">
            <Card>
              <CardHeader
                title="On file"
                subtitle={
                  docs === null
                    ? "Loading…"
                    : `The coach can answer from ${docs.length} document${docs.length === 1 ? "" : "s"}`
                }
              />
              <CardBody className="p-0">
                {docs === null ? (
                  <SkeletonList rows={3} topRule={false} label="Loading documents" />
                ) : docs.length === 0 ? (
                  <EmptyState
                    icon={<DocIcon />}
                    title="No documents yet"
                    description="Upload a PDF or TXT to start building your clinic's knowledge base."
                  />
                ) : (
                  <ul>
                    {docs.map((d, i) => (
                      <li
                        key={d.id}
                        className={[
                          "flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2",
                          i > 0 ? "border-t border-line" : "",
                        ].join(" ")}
                      >
                        <span
                          aria-hidden
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gold-soft text-gold-ink [&>svg]:h-5 [&>svg]:w-5"
                        >
                          <DocIcon />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[0.9rem] font-medium text-ink">{d.filename}</p>
                          <p className="mt-0.5 font-mono text-[0.65rem] tracking-[0.06em] text-ink-3 uppercase">
                            {d.file_type} · {d.chunk_count} chunk{d.chunk_count === 1 ? "" : "s"} ·{" "}
                            {new Date(d.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge
                          variant={
                            d.status === "ready" ? "success" : d.status === "processing" ? "warning" : "danger"
                          }
                        >
                          {d.status === "processing" ? (
                            <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-current" />
                          ) : null}
                          {d.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
