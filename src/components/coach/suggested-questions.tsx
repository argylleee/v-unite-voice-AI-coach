const GROUPS = [
  {
    label: "Sales & conversion",
    questions: [
      "Which treatment needs attention?",
      "Why is CoolSculpting underperforming?",
      "Based on our conversion data and consultation SOP, what should we change?",
    ],
  },
  {
    label: "Retention & follow-up",
    questions: [
      "Which customers need follow-up?",
      "Where are rebooking rates weak?",
    ],
  },
  {
    label: "Clinic knowledge",
    questions: [
      "What does our consultation SOP recommend?",
      "What is our cancellation policy?",
    ],
  },
] as const;

export function SuggestedQuestions({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="max-w-[var(--measure)] space-y-5">
      <p className="text-sm text-[var(--ink-2)]">
        Ask about the business in plain language. The coach answers from your customer records,
        your uploaded documents, or both — and shows its working.
      </p>
      <div className="space-y-4">
        {GROUPS.map((g) => (
          <div key={g.label}>
            <h3 className="record-label">{g.label}</h3>
            <ul className="mt-2 space-y-1">
              {g.questions.map((q) => (
                <li key={q}>
                  <button
                    type="button"
                    onClick={() => onPick(q)}
                    className="text-left text-sm text-[var(--accent-ink)] hover:text-[var(--accent)] hover:underline"
                  >
                    {q}
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
