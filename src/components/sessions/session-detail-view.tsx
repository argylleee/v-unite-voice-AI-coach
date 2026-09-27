"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, endSession, getSession, type SessionDetail } from "@/lib/client/api";
import { Alert, Badge, BTN_PRIMARY, BTN_SECONDARY, GUTTER, PageHeader } from "@/components/chart";
import { Skeleton } from "@/components/skeleton";

function SectionTitle({ children, aside }: { children: string; aside?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2 className="label shrink-0 text-ink-2">{children}</h2>
      <span className="h-px flex-1 bg-line" />
      {aside ? <span className="shrink-0">{aside}</span> : null}
    </div>
  );
}

export function SessionDetailView({ id }: { id: string }) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    getSession(id)
      .then(setDetail)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load that session."));
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

  function toggleCheck(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  return (
    <div className="min-h-[100dvh]">
      <PageHeader
        title={s?.title ?? "Session"}
        subtitle={
          s
            ? `${new Date(s.started_at).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}${s.ended_at ? ` — ended ${new Date(s.ended_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}` : ""}`
            : undefined
        }
        actions={
          <Link href="/sessions" className={BTN_SECONDARY}>
            All sessions
          </Link>
        }
        meta={
          detail ? (
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={ended ? "success" : "neutral"}>
                {ended ? "Summarised" : "Open"}
              </Badge>
              <span className="font-mono text-[0.7rem] tracking-[0.08em] text-ink-3 uppercase">
                {detail.messages.length} message{detail.messages.length === 1 ? "" : "s"}
              </span>
            </div>
          ) : null
        }
      />

      <div className={`${GUTTER} py-7 md:py-9`}>
        <div className="mx-auto max-w-4xl">
          {error ? (
            <div className="mb-5">
              <Alert type="error" title="Problem">
                {error}
              </Alert>
            </div>
          ) : null}

          {!detail && !error ? (
            <div
              className="space-y-4"
              role="status"
              aria-busy="true"
              aria-live="polite"
            >
              <span className="sr-only">Loading session…</span>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[94%]" />
              <Skeleton className="h-4 w-[72%]" />
              <Skeleton className="mt-4 h-44 w-full rounded-2xl" />
            </div>
          ) : null}

          {detail ? (
            <div className="space-y-10">
              {ended ? (
                <>
                  {/* Summary set as a display pull-quote */}
                  <section>
                    <SectionTitle>Summary</SectionTitle>
                    <blockquote className="border-l-2 border-gold pl-5 sm:pl-6">
                      <p className="font-display text-[1.25rem] leading-[1.55] text-balance text-ink sm:text-[1.4rem]">
                        {s?.summary}
                      </p>
                    </blockquote>
                  </section>

                  {findings.length > 0 ? (
                    <section>
                      <SectionTitle>Key findings</SectionTitle>
                      <ul className="border-t border-line">
                        {findings.map((f, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-4 border-b border-line py-3.5 text-[0.92rem] leading-relaxed text-ink-2"
                          >
                            <span className="mt-[7px] h-1 w-4 shrink-0 rounded-full bg-gold" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {plan.length > 0 ? (
                    <section>
                      <SectionTitle
                        aside={
                          <span className="font-mono text-[0.68rem] tracking-[0.08em] text-ink-3 uppercase tabular-nums">
                            {checked.size} / {plan.length} done
                          </span>
                        }
                      >
                        Action plan
                      </SectionTitle>
                      <ul className="border-t border-line">
                        {plan.map((a, i) => {
                          const done = checked.has(i);
                          return (
                            <li key={i} className="border-b border-line">
                              <div className="flex items-start gap-4 py-3.5">
                                <button
                                  type="button"
                                  onClick={() => toggleCheck(i)}
                                  aria-pressed={done}
                                  aria-label={`Mark "${a.action}" as ${done ? "not done" : "done"}`}
                                  className={[
                                    "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border transition-all duration-200",
                                    done
                                      ? "border-brand bg-brand text-on-brand"
                                      : "border-line-2 bg-surface hover:border-brand",
                                  ].join(" ")}
                                >
                                  {done ? (
                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                      <path d="M20 6 9 17l-5-5" />
                                    </svg>
                                  ) : null}
                                </button>

                                <div className="min-w-0 flex-1">
                                  <p
                                    className={[
                                      "text-[0.92rem] leading-relaxed",
                                      done ? "text-ink-3 line-through" : "text-ink",
                                    ].join(" ")}
                                  >
                                    {a.action}
                                  </p>
                                </div>

                                <Badge
                                  variant={
                                    a.priority === "high"
                                      ? "danger"
                                      : a.priority === "medium"
                                        ? "warning"
                                        : "neutral"
                                  }
                                >
                                  {a.priority}
                                </Badge>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ) : null}
                </>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface-2 px-5 py-5">
                  <p className="text-[0.92rem] text-ink-2">
                    This session hasn&apos;t been summarised yet.
                  </p>
                  <button
                    type="button"
                    onClick={summarise}
                    disabled={ending || detail.messages.length === 0}
                    className={BTN_PRIMARY}
                  >
                    {ending ? "Summarising…" : "Summarise now"}
                  </button>
                </div>
              )}

              {/* Transcript */}
              <section>
                <SectionTitle
                  aside={
                    <button
                      type="button"
                      onClick={() => setShowTranscript(!showTranscript)}
                      aria-expanded={showTranscript}
                      className="inline-flex items-center gap-1.5 font-mono text-[0.68rem] tracking-[0.08em] text-ink-3 uppercase transition-colors hover:text-brand"
                    >
                      {showTranscript ? "Hide" : "Show"}
                      <svg
                        className={`h-3.5 w-3.5 transition-transform duration-200 ${showTranscript ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                  }
                >
                  Transcript
                </SectionTitle>

                {showTranscript ? (
                  detail.messages.length === 0 ? (
                    <p className="text-sm text-ink-3">No messages.</p>
                  ) : (
                    <ol className="space-y-5 border-t border-line pt-5">
                      {detail.messages.map((m) => (
                        <li key={m.id}>
                          <p className="mb-1.5 font-mono text-[0.63rem] tracking-[0.1em] text-ink-3 uppercase">
                            {m.role === "assistant" ? "Coach" : "You"}
                            {m.input_mode === "voice" ? " · Spoken" : ""}
                          </p>
                          <p
                            className={[
                              "text-[0.92rem] leading-relaxed whitespace-pre-wrap",
                              m.role === "assistant"
                                ? "border-l-2 border-line pl-4 text-ink"
                                : "text-ink-2",
                            ].join(" ")}
                          >
                            {m.content}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )
                ) : null}
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
