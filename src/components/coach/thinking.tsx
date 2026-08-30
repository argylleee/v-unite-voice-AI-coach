const COPY: Record<string, string> = {
  thinking: "Consulting clinic records and knowledge base",
  transcribing: "Transcribing what you said",
  uploading: "Sending your recording",
  speaking: "Preparing the spoken reply",
};

export function Thinking({ phase }: { phase: keyof typeof COPY | string }) {
  return (
    <div className="flex items-center gap-3 py-1" aria-live="polite">
      <span
        aria-hidden
        className="relative block h-[2px] w-16 overflow-hidden rounded bg-[var(--rule)]"
      >
        <span className="absolute inset-y-0 left-0 w-1/3 bg-[var(--accent)] [animation:vu-scan_1.15s_ease-in-out_infinite]" />
      </span>
      <span className="font-mono text-[0.7rem] uppercase tracking-[0.12em] text-[var(--ink-3)]">
        {COPY[phase] ?? "Working"}
        <span className="[animation:vu-pulse_1.4s_ease-in-out_infinite]">…</span>
      </span>
      <style>{`@keyframes vu-scan{0%{transform:translateX(-120%)}100%{transform:translateX(320%)}}`}</style>
    </div>
  );
}
