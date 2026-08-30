type Q = { text: string; hybrid?: boolean };

const GROUPS: { label: string; questions: Q[] }[] = [
  {
    label: "Sales & conversion",
    questions: [
      { text: "Which treatment needs attention?" },
      { text: "Why is CoolSculpting underperforming?" },
      {
        text: "Based on our conversion data and consultation SOP, what should we change?",
        hybrid: true,
      },
    ],
  },
  {
    label: "Retention & follow-up",
    questions: [
      { text: "Which customers need follow-up?" },
      { text: "Where are rebooking rates weak?" },
    ],
  },
  {
    label: "Clinic knowledge",
    questions: [
      { text: "What does our consultation SOP recommend?" },
      { text: "What is our cancellation policy?" },
    ],
  },
];

export function SuggestedQuestions({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div>
      <p className="max-w-[var(--measure)] text-sm leading-relaxed text-[var(--ink-2)]">
        Ask about the business in plain language. The coach answers from your customer records,
        your uploaded documents, or both — and shows its working.
      </p>

      <div className="mt-7 space-y-7">
        {GROUPS.map((g) => (
          <div key={g.label}>
            <h3 className="record-label">{g.label}</h3>
            <ul className="mt-2.5 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
              {g.questions.map((q) => (
                <li key={q.text}>
                  <button
                    type="button"
                    onClick={() => onPick(q.text)}
                    className="group flex w-full items-start gap-3 py-2.5 text-left transition-colors hover:bg-[var(--paper-sunk)]"
                  >
                    <span
                      aria-hidden
                      className="mt-px font-mono text-xs text-[var(--rule-strong)] transition-colors group-hover:text-[var(--accent)]"
                    >
                      →
                    </span>
                    <span className="text-sm text-[var(--ink)] group-hover:text-[var(--accent-ink)]">
                      {q.text}
                    </span>
                    {q.hybrid ? (
                      <span className="ml-auto shrink-0 rounded-[3px] border border-[var(--accent)] bg-[var(--accent-soft)] px-1.5 py-0.5 font-mono text-[0.55rem] uppercase tracking-[0.12em] text-[var(--accent-ink)]">
                        data + docs
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
