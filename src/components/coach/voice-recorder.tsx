"use client";

import { useEffect, useRef, useState } from "react";

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
    if (recRef.current?.state === "recording") recRef.current.stop();
    setState("idle");
  }

  if (state === "error") {
    return (
      <button
        type="button"
        onClick={() => setState("idle")}
        className="h-[46px] shrink-0 rounded-full bg-danger-soft px-4 font-mono text-[0.68rem] font-medium tracking-[0.06em] text-danger uppercase transition-all active:scale-[0.97]"
      >
        Mic blocked
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
        "flex h-[46px] shrink-0 items-center gap-2.5 rounded-full px-4 transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
        recording
          ? "bg-danger-soft text-danger"
          : "bg-surface-2 text-ink-2 hover:bg-brand-soft hover:text-brand",
      ].join(" ")}
    >
      {recording ? (
        <>
          <span aria-hidden className="flex h-4 items-end gap-[3px]">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="w-[3px] origin-bottom rounded-full bg-current"
                style={{
                  height: "100%",
                  animation: `wave 0.7s ease-in-out ${i * 0.1}s infinite`,
                }}
              />
            ))}
          </span>
          <span className="font-mono text-[0.72rem] font-medium tabular-nums">
            {String(Math.floor(seconds / 60)).padStart(2, "0")}:
            {String(seconds % 60).padStart(2, "0")}
          </span>
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
          </svg>
          <span className="hidden font-mono text-[0.7rem] font-medium tracking-[0.06em] uppercase sm:inline">
            Speak
          </span>
        </>
      )}
    </button>
  );
}
