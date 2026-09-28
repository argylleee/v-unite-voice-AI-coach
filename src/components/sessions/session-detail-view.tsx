"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ApiError,
  askCoach,
  endSession,
  getSession,
  type CoachApiResponse,
  type SessionDetail,
  type SessionMessage,
} from "@/lib/client/api";
import { Alert, Badge, BTN_PRIMARY, BTN_SECONDARY, GUTTER, PageHeader } from "@/components/chart";
import { Skeleton } from "@/components/skeleton";
import { CoachAnswer } from "@/components/coach/coach-answer";
import { Thinking } from "@/components/coach/thinking";
import type { EvidenceItem } from "@/lib/validation/agent-response";

function SectionTitle({ children, aside }: { children: string; aside?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <h2 className="label shrink-0 text-ink-2">{children}</h2>
      <span className="h-px flex-1 bg-line" />
      {aside ? <span className="shrink-0">{aside}</span> : null}
    </div>
  );
}

/**
 * A stored coach turn keeps only its lead paragraph in `content` — the rest of the
 * answer (what it found, the read, the plan) is persisted alongside it. Rebuild the
 * same shape the live coach renders so a session reads exactly as the conversation
 * did, rather than as a string of openings. Returns null when nothing beyond the
 * lead paragraph was stored, so we never invent structure that isn't there.
 */
function fullAnswer(m: SessionMessage): CoachApiResponse | null {
  const raw = m.evidence;
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  const evidence: EvidenceItem[] = Array.isArray(o.evidence)
    ? o.evidence.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const e = item as Record<string, unknown>;
        if (typeof e.description !== "string") return [];
        return [
          {
            type: e.type === "knowledge_base" ? ("knowledge_base" as const) : ("customer_data" as const),
            description: e.description,
            source: typeof e.source === "string" ? e.source : null,
          },
        ];
      })
    : [];

  const insights = strings(o.insights);
  const recommendations = strings(o.recommendations);
  const follow_up_question = typeof o.follow_up_question === "string" ? o.follow_up_question : null;

  if (insights.length + evidence.length + recommendations.length === 0 && !follow_up_question) {
    return null;
  }
  return { answer: m.content, insights, evidence, recommendations, follow_up_question };
}

export function SessionDetailView({ id }: { id: string }) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [showConversation, setShowConversation] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getSession(id)
      .then(setDetail)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load that session."));
  }, [id]);

  const s = detail?.session;
  const ended = Boolean(s?.summary);
  const findings = s?.key_findings ?? [];
  const plan = s?.action_plan ?? [];

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

  function scrollToLatest(smooth = true) {
    requestAnimationFrame(() =>
      endRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "end" }),
    );
  }

  function askAbout(question: string) {
    setDraft(question);
    inputRef.current?.focus();
  }

  /**
   * Continue the conversation in place. The turn is appended locally so the thread
   * answers instantly; the backend persists it against this same session, so a
   * reload shows the same thing. A summarised session never reaches here — the
   * composer isn't rendered — but the guard keeps that true if state moves under us.
   */
  async function send() {
    const text = draft.trim();
    if (!text || sending || !detail || ended) return;
    setSending(true);
    setSendError(null);
    setDraft("");

    const stamp = Date.now();
    const userTurn: SessionMessage = {
      id: `local-${stamp}`,
      role: "user",
      content: text,
      input_mode: "chat",
      evidence: null,
      created_at: new Date().toISOString(),
    };
    setDetail({ ...detail, messages: [...detail.messages, userTurn] });
    scrollToLatest(false);

    try {
      const reply = await askCoach({ message: text, mode: "chat", sessionId: id });
      const coachTurn: SessionMessage = {
        id: `local-${stamp}-a`,
        role: "assistant",
        content: reply.answer,
        input_mode: "chat",
        evidence: {
          insights: reply.insights,
          evidence: reply.evidence,
          recommendations: reply.recommendations,
          follow_up_question: reply.follow_up_question,
        },
        created_at: new Date().toISOString(),
      };
      setDetail((d) => (d ? { ...d, messages: [...d.messages, coachTurn] } : d));
      scrollToLatest();
    } catch (e) {
      setSendError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
      setDraft(text);
      // Nothing was persisted — re-read so the thread stays truthful rather than
      // leaving an optimistic message that only exists in this tab.
      getSession(id).then(setDetail).catch(() => undefined);
    } finally {
      setSending(false);
    }
  }

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
              <span className="font-mono text-[0.7rem] tracking-[0.08em] text-ink-3 uppercase tabular-nums">
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
            <div className="space-y-4" role="status" aria-busy="true" aria-live="polite">
              <span className="sr-only">Loading session…</span>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[94%]" />
              <Skeleton className="h-4 w-[72%]" />
              <Skeleton className="mt-4 h-44 w-full rounded-2xl" />
            </div>
          ) : null}

          {detail ? (
            <>
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
                    <p className="max-w-[46ch] text-[0.92rem] leading-relaxed text-ink-2">
                      This session is still open — keep the conversation going below, or
                      summarise it when you&rsquo;re done.
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

                {/* The whole conversation, exactly as it played out in the coach */}
                <section>
                  <SectionTitle
                    aside={
                      <button
                        type="button"
                        onClick={() => setShowConversation(!showConversation)}
                        aria-expanded={showConversation}
                        className="inline-flex items-center gap-1.5 font-mono text-[0.68rem] tracking-[0.08em] text-ink-3 uppercase transition-colors hover:text-brand"
                      >
                        {showConversation ? "Hide" : "Show"}
                        <svg
                          className={`h-3.5 w-3.5 transition-transform duration-200 ${showConversation ? "rotate-180" : ""}`}
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
                    Conversation
                  </SectionTitle>

                  {showConversation ? (
                    detail.messages.length === 0 && !sending ? (
                      <p className="border-t border-line pt-5 text-sm text-ink-3">
                        No messages yet — ask the first question below.
                      </p>
                    ) : (
                      <ol className="space-y-6 border-t border-line pt-5">
                        {detail.messages.map((m) => {
                          if (m.role === "user") {
                            return (
                              <li key={m.id} className="flex justify-end animate-rise">
                                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-3 text-[0.9rem] leading-relaxed text-on-brand shadow-[var(--shadow-1)]">
                                  <p className="whitespace-pre-wrap">{m.content}</p>
                                  {m.input_mode === "voice" ? (
                                    <p className="mt-1.5 font-mono text-[0.62rem] tracking-[0.1em] uppercase opacity-70">
                                      Spoken
                                    </p>
                                  ) : null}
                                </div>
                              </li>
                            );
                          }

                          if (m.role === "assistant") {
                            const data = fullAnswer(m);
                            return (
                              <li key={m.id} className="animate-fade-up">
                                {data ? (
                                  <CoachAnswer
                                    data={data}
                                    onAskFollowUp={ended ? undefined : askAbout}
                                  />
                                ) : (
                                  <div className="max-w-[64ch] border-l-2 border-gold pl-4 sm:pl-5">
                                    <p className="font-display text-[1.08rem] leading-[1.65] text-ink sm:text-[1.14rem]">
                                      {m.content}
                                    </p>
                                  </div>
                                )}
                              </li>
                            );
                          }

                          return (
                            <li
                              key={m.id}
                              className="font-mono text-[0.7rem] tracking-[0.06em] text-ink-3 uppercase"
                            >
                              {m.content}
                            </li>
                          );
                        })}
                        {sending ? (
                          <li>
                            <Thinking phase="thinking" />
                          </li>
                        ) : null}
                      </ol>
                    )
                  ) : null}

                  <div ref={endRef} className="h-px scroll-mb-32" aria-hidden />
                </section>
              </div>

              {/* A summarised session is a record: read-only from here. */}
              {!ended ? (
                <div className="sticky bottom-[var(--shell-bottom)] z-10 mt-10 border-t border-line bg-paper/95 py-3.5 backdrop-blur-md md:py-4">
                  {sendError ? (
                    <div className="mb-3">
                      <Alert type="error" title="That didn’t send">
                        {sendError}
                      </Alert>
                    </div>
                  ) : null}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void send();
                    }}
                    className="flex items-end gap-2.5"
                  >
                    <label htmlFor="session-input" className="sr-only">
                      Ask the coach in this session
                    </label>
                    <textarea
                      id="session-input"
                      ref={inputRef}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void send();
                        }
                      }}
                      rows={1}
                      disabled={sending}
                      placeholder="Ask another question in this session…"
                      className="max-h-40 min-h-[46px] flex-1 resize-none rounded-2xl border border-line bg-surface px-3.5 py-3 text-[0.9rem] text-ink shadow-[var(--shadow-1)] transition-all placeholder:text-ink-3 focus:border-brand focus:shadow-[var(--shadow-2)] focus:outline-none disabled:opacity-50 sm:px-4"
                    />
                    <button
                      type="submit"
                      disabled={sending || draft.trim().length === 0}
                      className="grid h-[46px] shrink-0 place-items-center rounded-full bg-brand px-4 text-sm font-semibold text-on-brand shadow-[var(--shadow-1)] transition-all hover:bg-brand-deep active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 sm:px-5"
                    >
                      Ask
                    </button>
                  </form>

                  <p className="mt-2 hidden font-mono text-[0.65rem] tracking-[0.08em] text-ink-3 uppercase md:block">
                    Enter to send · Shift + Enter for a new line
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
