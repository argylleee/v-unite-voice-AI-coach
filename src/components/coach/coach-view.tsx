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
import { Notice, PageHeader } from "@/components/chart";
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

export function CoachView() {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [ending, setEnding] = useState(false);
  const sessionRef = useRef<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const busy = phase !== "idle";

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, phase]);

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

  return (
    <div className="flex h-[100dvh] flex-col">
      <PageHeader
        title="Coach"
        intro="Ask about sales, retention, or what a document says. Every answer cites its evidence."
        actions={
          turns.length > 0 ? (
            <button
              type="button"
              onClick={finish}
              disabled={ending || busy}
              className="rounded-[3px] border border-[var(--rule-strong)] bg-[var(--paper-raised)] px-3 py-1.5 text-sm text-[var(--ink-2)] hover:border-[var(--accent)] hover:text-[var(--accent-ink)] disabled:opacity-40"
            >
              {ending ? "Summarising…" : "End & summarise"}
            </button>
          ) : null
        }
      />

      <div ref={feedRef} className="flex-1 overflow-y-auto px-5 py-6 md:px-8">
        {turns.length === 0 && !busy ? (
          <SuggestedQuestions onPick={sendText} />
        ) : (
          <div className="space-y-8">
            {turns.map((turn) =>
              turn.role === "user" ? (
                <div key={turn.id} className="max-w-[var(--measure)]">
                  <p className="record-label">
                    You{turn.mode === "voice" ? " · spoken" : ""}
                  </p>
                  <p className="mt-1 text-[0.95rem] text-[var(--ink)]">{turn.text}</p>
                </div>
              ) : turn.mode === "chat" ? (
                <div key={turn.id}>
                  <p className="record-label mb-2">Coach</p>
                  <CoachAnswer data={turn.data} onAskFollowUp={sendText} />
                </div>
              ) : (
                <div key={turn.id} className="max-w-[var(--measure)] space-y-2">
                  <p className="record-label">Coach · spoken</p>
                  <p className="text-[1.0625rem] leading-relaxed text-[var(--ink)]">
                    {turn.text}
                  </p>
                  <audio
                    controls
                    autoPlay
                    src={turn.audio}
                    onPlay={() => setPhase("speaking")}
                    onEnded={() => setPhase("idle")}
                    className="w-full max-w-sm"
                  />
                </div>
              ),
            )}
            {busy ? <Thinking phase={phase} /> : null}
          </div>
        )}
      </div>

      <div className="border-t border-[var(--rule)] bg-[var(--paper-raised)] px-5 py-3 md:px-8">
        {error ? (
          <div className="mb-3">
            <Notice tone="danger" title="That didn’t go through">
              {error}
            </Notice>
          </div>
        ) : null}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendText(draft);
          }}
          className="flex items-end gap-2"
        >
          <label htmlFor="coach-input" className="sr-only">
            Ask the coach
          </label>
          <textarea
            id="coach-input"
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
            placeholder="Ask about a treatment, a customer segment, or a policy…"
            className="min-h-[2.6rem] flex-1 resize-none rounded-[3px] border border-[var(--rule-strong)] bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:border-[var(--accent)] disabled:opacity-50"
          />
          <VoiceRecorder disabled={busy} onRecorded={sendVoice} />
          <button
            type="submit"
            disabled={busy || draft.trim().length === 0}
            className="shrink-0 rounded-[3px] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--paper-raised)] hover:bg-[var(--accent-ink)] disabled:opacity-40"
          >
            Ask
          </button>
        </form>
      </div>
    </div>
  );
}
