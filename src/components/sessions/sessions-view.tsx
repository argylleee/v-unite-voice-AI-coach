"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, listSessions, type SessionListItem } from "@/lib/client/api";
import { Alert, Badge, BTN_PRIMARY, EmptyState, GUTTER, PageHeader } from "@/components/chart";
import { SkeletonList } from "@/components/skeleton";

type Filter = "all" | "summarised" | "open";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "summarised", label: "Summarised" },
  { id: "open", label: "Open" },
];

const matches = (s: SessionListItem, f: Filter) =>
  f === "summarised" ? s.has_summary : f === "open" ? !s.ended_at : true;

export function SessionsView() {
  const [sessions, setSessions] = useState<SessionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load sessions."));
  }, []);

  const filtered = (sessions ?? []).filter((s) => matches(s, filter));

  return (
    <div className="min-h-[100dvh]">
      <PageHeader
        title="Sessions"
        subtitle="Every conversation is kept. End one and the coach writes a summary, the key findings, and a prioritised action plan."
        actions={
          <Link href="/coach" className={BTN_PRIMARY}>
            New session
          </Link>
        }
      />

      <div className={`${GUTTER} py-7 md:py-9`}>
        <div className="mx-auto max-w-4xl">
          {/* Filter tabs: ruled into the list they control rather than parked in
              the masthead, with live counts so the choice is informed. */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            {/* Segmented control rather than a ruled tab strip: one track, one
                filled pill for the live choice, counts inside the buttons. */}
            <div
              role="group"
              aria-label="Filter sessions"
              className="inline-flex items-center gap-1 rounded-full bg-surface-2 p-1"
            >
              {FILTERS.map((f) => {
                const active = filter === f.id;
                const n = sessions ? sessions.filter((s) => matches(s, f.id)).length : null;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilter(f.id)}
                    aria-pressed={active}
                    className={[
                      "group inline-flex items-center gap-2 rounded-full px-4 py-1.5 transition-all duration-200 active:scale-[0.97]",
                      active
                        ? "bg-brand text-on-brand shadow-[var(--shadow-1)]"
                        : "text-ink-3 hover:text-ink",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "label text-[10px] transition-colors duration-200",
                        active ? "text-on-brand" : "text-ink-3 group-hover:text-ink",
                      ].join(" ")}
                    >
                      {f.label}
                    </span>
                    {n !== null ? (
                      <span
                        className={[
                          "font-mono text-[0.68rem] tabular-nums transition-colors duration-200",
                          active ? "text-on-brand/70" : "text-ink-3 group-hover:text-ink",
                        ].join(" ")}
                      >
                        {n}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <p className="label text-[9.5px]">
              {sessions === null && !error ? "Loading…" : `${filtered.length} shown`}
            </p>
          </div>

          {error ? (
            <div className="mb-5">
              <Alert type="error" title="Couldn't load sessions">
                {error}
              </Alert>
            </div>
          ) : null}

          {sessions === null && !error ? (
            <SkeletonList rows={5} label="Loading sessions" />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={
                <svg fill="none" stroke="currentColor" strokeWidth={1.4} viewBox="0 0 24 24">
                  <path d="M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              }
              title={filter === "all" ? "No sessions yet" : "Nothing in this filter"}
              description={
                filter === "all"
                  ? "Start a conversation on the Coach page — it is saved automatically."
                  : "Try another filter to see the rest of your sessions."
              }
              action={
                filter === "all" ? (
                  <Link href="/coach" className={BTN_PRIMARY}>
                    Start coaching
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <ul className="border-t border-line">
              {filtered.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/sessions/${s.id}`}
                    className="group flex items-start gap-5 border-b border-line py-5 transition-colors duration-200 hover:bg-surface"
                  >
                    <span className="mt-1 w-16 shrink-0 font-mono text-[0.65rem] leading-relaxed tracking-[0.06em] text-ink-3 uppercase">
                      {new Date(s.started_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                      <br />
                      {new Date(s.started_at).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="font-display text-[1.12rem] leading-snug font-semibold text-ink transition-colors group-hover:text-brand">
                        {s.title ?? "Coaching session"}
                      </p>
                      <p className="mt-1 font-mono text-[0.65rem] tracking-[0.06em] text-ink-3 uppercase">
                        {s.message_count} message{s.message_count === 1 ? "" : "s"}
                      </p>
                    </div>

                    <div className="mt-1 flex shrink-0 items-center gap-3">
                      <Badge
                        variant={s.has_summary ? "success" : s.ended_at ? "warning" : "neutral"}
                      >
                        {s.has_summary ? "Summarised" : s.ended_at ? "Ended" : "Open"}
                      </Badge>
                      <span
                        aria-hidden
                        className="font-mono text-[0.85rem] text-ink-3 transition-all duration-200 group-hover:translate-x-1 group-hover:text-brand"
                      >
                        →
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
