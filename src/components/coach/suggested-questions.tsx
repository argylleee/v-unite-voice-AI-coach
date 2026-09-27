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

/**
 * The opening state of the coach: an index of questions. Numbered and set in the
 * display serif, one rule per section (above its label) and none between entries —
 * a table of contents rather than a stack of tappable cards, so the prompts read
 * as the page's content instead of as chrome.
 */
export function SuggestedQuestions({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div>
      <h2 className="font-display text-[1.9rem] leading-[1.08] font-semibold text-balance text-ink sm:text-[2.3rem]">
        What’s on your mind?
      </h2>
      <p className="mt-3.5 max-w-[54ch] text-[0.95rem] leading-relaxed text-ink-2">
        Ask in plain language. The coach answers from your customer records, your uploaded
        documents, or both — and always shows which.
      </p>

      <div className="mt-9 space-y-8">
        {GROUPS.map((g) => (
          <section key={g.label}>
            <div className="mb-2 flex items-center gap-3">
              <h3 className="label shrink-0">{g.label}</h3>
              <span className="h-px flex-1 bg-line" />
            </div>

            <ul>
              {g.questions.map((q, i) => (
                <li key={q.text}>
                  <button
                    type="button"
                    onClick={() => onPick(q.text)}
                    className="group flex w-full items-start gap-4 rounded-lg px-2 py-3 -mx-2 text-left transition-colors duration-200 hover:bg-surface sm:gap-6"
                  >
                    <span className="mt-[3px] w-5 shrink-0 font-mono text-[0.68rem] font-semibold tracking-[0.08em] text-ink-3 tabular-nums transition-colors duration-200 group-hover:text-brand">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1 font-display text-[1.06rem] leading-snug text-ink transition-colors duration-200 group-hover:text-brand">
                      {q.text}
                    </span>
                    {q.hybrid ? (
                      <span className="mt-0.5 shrink-0 rounded-full bg-gold-soft px-2.5 py-1 font-mono text-[0.6rem] font-medium tracking-[0.08em] text-gold-ink uppercase">
                        Data + docs
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
