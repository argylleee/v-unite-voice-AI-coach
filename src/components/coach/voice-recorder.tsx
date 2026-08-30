"use client";

import { useEffect, useRef, useState } from "react";

// Push-to-record. Chrome records audio/webm;opus, Safari audio/mp4 — both accepted downstream
// (Groq Whisper, n8n/PHASE_6_VOICE.md). The component owns idle / recording / mic-error; the
// parent owns the uploading → transcribing → thinking → speaking pipeline.

type State = "idle" | "recording" | "error";

export function VoiceRecorder({
  disabled,
  onRecorded,
}: {
  disabled?: boolean;
  onRecorded: (blob: Blob) => void;
}) {
  const [state, setState] = useState<State>("idle");
  const [seconds, setSeconds] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      recRef.current?.stream.getTracks().forEach((t) => t.stop());
      if (tickRef.current) clearInterval(tickRef.current);
    },
    [],
  );

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size > 0) onRecorded(blob);
      };
      rec.start();
      recRef.current = rec;
      setState("recording");
      setSeconds(0);
      tickRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setState("error");
    }
  }

  function stop() {
    if (tickRef.current) clearInterval(tickRef.current);
    recRef.current?.state === "recording" && recRef.current.stop();
    setState("idle");
  }

  if (state === "error") {
    return (
      <button
        type="button"
        onClick={() => setState("idle")}
        className="shrink-0 rounded-[3px] border border-[var(--danger-ink)] bg-[var(--danger-soft)] px-3 py-2 text-xs text-[var(--danger-ink)]"
      >
        Mic blocked — retry
      </button>
    );
  }

  const recording = state === "recording";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={recording ? stop : start}
      aria-pressed={recording}
      aria-label={recording ? "Stop recording" : "Record a question"}
      className={[
        "flex shrink-0 items-center gap-2 rounded-[3px] border px-3 py-2 text-sm transition-colors disabled:opacity-40",
        recording
          ? "border-[var(--danger-ink)] bg-[var(--danger-soft)] text-[var(--danger-ink)]"
          : "border-[var(--rule-strong)] bg-[var(--paper-raised)] text-[var(--ink-2)] hover:border-[var(--accent)] hover:text-[var(--accent-ink)]",
      ].join(" ")}
    >
      <span
        aria-hidden
        className={[
          "block h-2.5 w-2.5",
          recording
            ? "rounded-[1px] bg-current"
            : "rounded-full bg-[var(--danger-ink)]",
        ].join(" ")}
      />
      {recording ? (
        <span className="font-mono tabular-nums text-xs">
          {String(Math.floor(seconds / 60)).padStart(1, "0")}:
          {String(seconds % 60).padStart(2, "0")}
        </span>
      ) : (
        <span>Speak</span>
      )}
    </button>
  );
}
