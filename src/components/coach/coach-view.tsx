"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ApiError,
  askCoach,
  askCoachByVoice,
  createSession,
  endSession,
  type CoachApiResponse,
} from "@/lib/client/api";
import { Alert, BTN_SECONDARY, GUTTER } from "@/components/chart";
import { AskNav, type AskNavItem } from "./ask-nav";
import { CoachAnswer } from "./coach-answer";
import { SuggestedQuestions } from "./suggested-questions";
import { Thinking } from "./thinking";
import { VoiceRecorder } from "./voice-recorder";

type Phase = "idle" | "thinking" | "uploading" | "transcribing" | "speaking";

type Turn =
  | { id: string; role: "user"; mode: "chat" | "voice"; text: string }
  | { id: string; role: "assistant"; mode: "chat"; data: CoachApiResponse }
  | { id: string; role: "assistant"; mode: "voice"; text: string; audio: string };

let seq = 0;
const nextId = () => `t${++seq}`;

/**
 * The four figures that open the quick-ask nav beside the greeting. Each carries
 * the question it should raise when tapped — the metric and the coaching prompt
 * are the same object.
 */
const METRICS: (Omit<AskNavItem, "onClick"> & { question: string })[] = [
  {
    label: "CoolSculpting",
    value: "27.6",
    unit: "%",
    change: "4.2 under target",
    changeType: "down",
    question: "Why is CoolSculpting converting below target?",
  },
  {
    label: "Botox",
    value: "68.3",
    unit: "%",
    change: "strongest",
    changeType: "up",
    question: "Botox is our strongest converter — how do we protect it?",
  },
  {
    label: "Rebooking",
    value: "41.2",
    unit: "%",
    change: "2.1 up",
    changeType: "up",
    question: "Rebooking sits at 41.2% — what would move it?",
  },
  {
    label: "Lapsed clients",
    value: "23",
    unit: "",
    change: "over 90 days",
    changeType: "flat",
    question: "Which lapsed clients are worth winning back first?",
  },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function RefreshIcon() {
  return (
    <svg
      aria-hidden
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M20.5 12a8.5 8.5 0 1 1-2.49-6.01" />
      <path d="M20.5 4v5h-5" />
    </svg>
  );
}

export function CoachView() {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [ending, setEnding] = useState(false);
  const sessionRef = useRef<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const busy = phase !== "idle";

  // Follow the conversation down, but never on first paint — scrolling an empty
  // feed to its own bottom threw the opening prompts half off-screen.
  useEffect(() => {
    if (turns.length === 0) return;
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, phase]);

  const askAbout = useCallback((q: string) => {
    setDraft(q);
    inputRef.current?.focus();
  }, []);

  /**
   * Back to the opening board. One control serves both reasons for needing it —
   * the user who wants a clean slate, and the user who just hit "That didn't send"
   * and wants their prompts back instead of a dead thread. The session itself is
   * kept: nothing here talks to the server, so a restart can never fail.
   */
  const newChat = useCallback(() => {
    if (busy || ending) return;
    setTurns([]);
    setError(null);
    setDraft("");
    setPhase("idle");
    setEnding(false);
    feedRef.current?.scrollTo({ top: 0 });
  }, [busy, ending]);

  const ensureSession = useCallback(async () => {
    if (sessionRef.current) return sessionRef.current;
    const id = await createSession(`Coaching session · ${new Date().toLocaleDateString()}`);
    sessionRef.current = id;
    return id;
  }, []);

  const sendText = useCallback(
    async (message: string) => {
      const text = message.trim();
      if (!text || busy) return;
      setError(null);
      setDraft("");
      setTurns((t) => [...t, { id: nextId(), role: "user", mode: "chat", text }]);
      setPhase("thinking");
      try {
        const sessionId = await ensureSession();
        const data = await askCoach({ message: text, mode: "chat", sessionId });
        setTurns((t) => [...t, { id: nextId(), role: "assistant", mode: "chat", data }]);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
      } finally {
        setPhase("idle");
      }
    },
    [busy, ensureSession],
  );

  const sendVoice = useCallback(
    async (blob: Blob) => {
      if (busy) return;
      setError(null);
      setPhase("uploading");
      try {
        const sessionId = await ensureSession();
        setPhase("transcribing");
        const res = await askCoachByVoice(blob, sessionId);
        setTurns((t) => [
          ...t,
          { id: nextId(), role: "user", mode: "voice", text: res.transcript },
          {
            id: nextId(),
            role: "assistant",
            mode: "voice",
            text: res.answer,
            audio: `data:${res.audio_mime || "audio/mpeg"};base64,${res.audio_base64}`,
          },
        ]);
        setPhase("speaking");
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Couldn't process that recording.");
        setPhase("idle");
      }
    },
    [busy, ensureSession],
  );

  async function finish() {
    if (!sessionRef.current || ending) return;
    setEnding(true);
    setError(null);
    try {
      await endSession(sessionRef.current);
      router.push(`/sessions/${sessionRef.current}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't summarise the session.");
      setEnding(false);
    }
  }

  const hasConversation = turns.length > 0;

  return (
    <div className="flex h-[calc(100dvh-var(--shell-top)-var(--shell-bottom))] flex-col overflow-hidden">
      {/* ---------- Masthead, with the quick-ask nav beside it ---------- */}
      <header className={`${GUTTER} shrink-0 border-b border-line pt-7 pb-5 md:pt-9 md:pb-6`}>
        {/* Same column as the feed below, so the greeting and the prompts share
            one left edge and the rule reads as a full-bleed divider over it. */}
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between xl:gap-10">
            <div className="min-w-0">
              <h1 className="font-display text-[2rem] leading-[1.05] font-semibold text-ink sm:text-[2.6rem]">
                {greeting()}.
              </h1>
              <p className="mt-1.5 max-w-[42ch] text-[0.9rem] leading-relaxed text-ink-2">
                Ask about a treatment, a segment, or a policy — the coach answers from your records
                and your documents, and shows its working.
              </p>
              {hasConversation || error ? (
                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  {hasConversation ? (
                    <button
                      type="button"
                      onClick={finish}
                      disabled={ending || busy}
                      className={BTN_SECONDARY}
                    >
                      {ending ? "Summarising…" : "End & summarise"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={newChat}
                    disabled={busy || ending}
                    className={BTN_SECONDARY}
                  >
                    <RefreshIcon />
                    New chat
                  </button>
                </div>
              ) : null}
            </div>

            <AskNav
              items={METRICS.map(({ question, ...m }) => ({
                ...m,
                onClick: () => askAbout(question),
              }))}
            />
          </div>
        </div>
      </header>

      {/* ---------- Feed ---------- */}
      <div ref={feedRef} className={`min-h-0 flex-1 overflow-y-auto ${GUTTER} py-6 md:py-8`}>
        {!hasConversation && !busy ? (
          <div className="mx-auto max-w-4xl animate-fade-in">
            <SuggestedQuestions onPick={sendText} />
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-6">
            {turns.map((turn) =>
              turn.role === "user" ? (
                <div key={turn.id} className="flex justify-end animate-rise">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-3 text-[0.9rem] leading-relaxed text-on-brand shadow-[var(--shadow-1)]">
                    <p className="whitespace-pre-wrap">{turn.text}</p>
                    {turn.mode === "voice" ? (
                      <p className="mt-1.5 font-mono text-[0.62rem] tracking-[0.1em] uppercase opacity-70">
                        Spoken
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : turn.mode === "chat" ? (
                <div key={turn.id} className="animate-fade-up">
                  <CoachAnswer
                    data={turn.data}
                    onAskFollowUp={(question) =>
                      askAbout(
                        `Please expand on this advice: ${turn.data.answer.slice(0, 3000)}\nSuggested next step: ${question.slice(0, 1000)}`,
                      )
                    }
                  />
                </div>
              ) : (
                <div key={turn.id} className="animate-fade-up">
                  <div className="rounded-2xl rounded-bl-md bg-surface px-4 py-3 shadow-[var(--shadow-1)]">
                    <p className="text-[0.9rem] leading-relaxed text-ink">{turn.text}</p>
                    <audio
                      controls
                      autoPlay
                      src={turn.audio}
                      onPlay={() => setPhase("speaking")}
                      onEnded={() => setPhase("idle")}
                      className="mt-3 w-full"
                    />
                  </div>
                </div>
              ),
            )}
            {busy ? <Thinking phase={phase} /> : null}
          </div>
        )}
      </div>

      {/* ---------- Composer ---------- */}
      <div className={`${GUTTER} shrink-0 border-t border-line bg-paper/90 py-3.5 backdrop-blur-md md:py-4`}>
        <div className="mx-auto max-w-4xl">
          {error ? (
            <div className="mb-3">
              <Alert type="error" title="That didn’t send">
                {error}
              </Alert>
            </div>
          ) : null}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendText(draft);
            }}
            className="flex items-end gap-2.5"
          >
            <label htmlFor="coach-input" className="sr-only">
              Ask the coach
            </label>
            <textarea
              id="coach-input"
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendText(draft);
                }
              }}
              rows={1}
              disabled={busy}
              placeholder="Why is CoolSculpting down?"
              className="max-h-40 min-h-[46px] flex-1 resize-none rounded-2xl border border-line bg-surface px-3.5 py-3 text-[0.9rem] text-ink shadow-[var(--shadow-1)] transition-all placeholder:text-ink-3 focus:border-brand focus:shadow-[var(--shadow-2)] focus:outline-none disabled:opacity-50 sm:px-4"
            />
            <VoiceRecorder disabled={busy} onRecorded={sendVoice} />
            <button
              type="submit"
              disabled={busy || draft.trim().length === 0}
              className="grid h-[46px] shrink-0 place-items-center rounded-full bg-brand px-4 text-sm font-semibold text-on-brand shadow-[var(--shadow-1)] transition-all hover:bg-brand-deep active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40 sm:px-5"
            >
              Ask
            </button>
          </form>

          <p className="mt-2 hidden font-mono text-[0.65rem] tracking-[0.08em] text-ink-3 uppercase md:block">
            Enter to send · Shift + Enter for a new line
          </p>
        </div>
      </div>
    </div>
  );
}
