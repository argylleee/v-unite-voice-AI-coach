const COPY: Record<string, string> = {
  thinking: "Reading your clinic records and knowledge base",
  transcribing: "Listening to what you said",
  uploading: "Sending your recording",
  speaking: "Preparing the spoken reply",
};

export function Thinking({ phase }: { phase: keyof typeof COPY | string }) {
  return (
    <div
      className="flex items-center gap-3.5 py-1"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden
        className="relative block h-[3px] w-24 shrink-0 overflow-hidden rounded-full bg-line"
      >
        <span className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-gold [animation:scan_1.15s_ease-in-out_infinite]" />
      </span>
      <span className="text-[0.85rem] text-ink-3">
        {COPY[phase] ?? "Working"}
        <span className="animate-blink">…</span>
      </span>
    </div>
  );
}
