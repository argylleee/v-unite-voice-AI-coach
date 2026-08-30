"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, listSessions, type SessionListItem } from "@/lib/client/api";
import { EmptyState, Notice, PageHeader } from "@/components/chart";

export function SessionsView() {
  const [sessions, setSessions] = useState<SessionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Couldn't load sessions."),
      );
  }, []);

  return (
    <div className="min-h-[100dvh]">
      <PageHeader
        title="Sessions"
        intro="Every coaching conversation is kept. End one to get a summary and a prioritised action plan."
        actions={
          <Link
            href="/coach"
            className="rounded-[3px] bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[var(--paper-raised)] hover:bg-[var(--accent-ink)]"
          >
            New session
          </Link>
        }
      />

      <div className="mx-auto max-w-[var(--measure)] px-5 py-6 md:px-8">
        {error ? <Notice title="Couldn’t load sessions">{error}</Notice> : null}

        {sessions === null && !error ? (
          <p className="text-sm text-[var(--ink-3)]">Loading…</p>
        ) : sessions && sessions.length === 0 ? (
          <EmptyState title="No sessions yet">
            Start a conversation on the Coach page — it’s saved automatically.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-[var(--rule)]">
            {(sessions ?? []).map((s) => (
              <li key={s.id}>
                <Link
                  href={`/sessions/${s.id}`}
                  className="flex items-center justify-between gap-4 py-3 hover:bg-[var(--paper-sunk)]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[var(--ink)]">
                      {s.title ?? "Coaching session"}
                    </p>
                    <p className="font-mono text-[0.7rem] text-[var(--ink-3)]">
                      {new Date(s.started_at).toLocaleString()} ·{" "}
                      {s.message_count} {s.message_count === 1 ? "message" : "messages"}
                    </p>
                  </div>
                  <span
                    className={[
                      "shrink-0 font-mono text-[0.6rem] uppercase tracking-[0.12em]",
                      s.has_summary ? "text-[var(--accent-ink)]" : "text-[var(--ink-3)]",
                    ].join(" ")}
                  >
                    {s.has_summary ? "Summarised" : s.ended_at ? "Ended" : "Open"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
