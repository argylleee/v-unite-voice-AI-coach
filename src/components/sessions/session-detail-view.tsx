"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ApiError,
  endSession,
  getSession,
  type SessionDetail,
} from "@/lib/client/api";
import { Notice, PageHeader, PriorityTag, Section } from "@/components/chart";

export function SessionDetailView({ id }: { id: string }) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    getSession(id)
      .then(setDetail)
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Couldn't load that session."),
      );
  }, [id]);

  async function summarise() {
    setEnding(true);
    setError(null);
    try {
      await endSession(id);
      setDetail(await getSession(id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't summarise the session.");
    } finally {
      setEnding(false);
    }
  }

  const s = detail?.session;
  const ended = Boolean(s?.summary);
  const findings = s?.key_findings ?? [];
  const plan = s?.action_plan ?? [];

  return (
    <div className="min-h-[100dvh]">
      <PageHeader
        title={s?.title ?? "Session"}
        intro={
          s
            ? `${new Date(s.started_at).toLocaleString()}${
                s.ended_at ? ` — ended ${new Date(s.ended_at).toLocaleString()}` : ""
              }`
            : undefined
        }
        actions={
          <Link
            href="/sessions"
            className="rounded-[3px] border border-[var(--rule-strong)] bg-[var(--paper-raised)] px-3 py-1.5 text-sm text-[var(--ink-2)] hover:border-[var(--accent)]"
          >
            All sessions
          </Link>
        }
      />

      <div className="mx-auto max-w-[var(--measure)] space-y-8 px-5 py-6 md:px-8">
        {error ? <Notice title="Problem">{error}</Notice> : null}
        {!detail && !error ? <p className="text-sm text-[var(--ink-3)]">Loading…</p> : null}

        {detail ? (
          <>
            {ended ? (
              <div className="space-y-5">
                <div>
                  <h3 className="record-label">Summary</h3>
                  <p className="mt-2 text-[1.0625rem] leading-relaxed text-[var(--ink)]">
                    {s?.summary}
                  </p>
                </div>

                {findings.length > 0 ? (
                  <Section label="Key findings">
                    <ul className="space-y-1.5">
                      {findings.map((f, i) => (
                        <li
                          key={i}
                          className="grid grid-cols-[1rem_1fr] gap-x-2 text-sm text-[var(--ink-2)]"
                        >
                          <span aria-hidden className="text-[var(--rule-strong)]">
                            —
                          </span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </Section>
                ) : null}

                {plan.length > 0 ? (
                  <Section label="Action plan">
                    <ol className="space-y-2">
                      {plan.map((a, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-[var(--ink)]">
                          <PriorityTag priority={a.priority} />
                          <span>{a.action}</span>
                        </li>
                      ))}
                    </ol>
                  </Section>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--rule)] pb-4">
                <p className="text-sm text-[var(--ink-2)]">
                  This session hasn’t been summarised yet.
                </p>
                <button
                  type="button"
                  onClick={summarise}
                  disabled={ending || detail.messages.length === 0}
                  className="rounded-[3px] bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[var(--paper-raised)] hover:bg-[var(--accent-ink)] disabled:opacity-40"
                >
                  {ending ? "Summarising…" : "Summarise now"}
                </button>
              </div>
            )}

            <Section label="Transcript" aside={`${detail.messages.length} messages`}>
              {detail.messages.length === 0 ? (
                <p className="text-sm text-[var(--ink-3)]">No messages.</p>
              ) : (
                <ol className="space-y-4">
                  {detail.messages.map((m) => (
                    <li key={m.id}>
                      <p className="record-label">
                        {m.role === "assistant" ? "Coach" : "You"}
                        {m.input_mode === "voice" ? " · spoken" : ""}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--ink)]">
                        {m.content}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </Section>
          </>
        ) : null}
      </div>
    </div>
  );
}
