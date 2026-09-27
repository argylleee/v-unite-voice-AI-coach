"use client";

import { useState } from "react";
import type { CoachApiResponse } from "@/lib/validation/agent-response";
import { Alert, FeedbackButtons } from "@/components/chart";
import { EvidenceList } from "./evidence-list";

function SectionTitle({ children, count }: { children: string; count?: string }) {
  return (
    <div className="mb-3.5 flex items-center gap-3">
      <h3 className="label shrink-0 text-ink-2">{children}</h3>
      <span className="h-px flex-1 bg-line" />
      {count ? <span className="label shrink-0 text-[0.62rem]">{count}</span> : null}
    </div>
  );
}

export function CoachAnswer({
  data,
  onAskFollowUp,
}: {
  data: CoachApiResponse;
  onAskFollowUp?: (q: string) => void;
}) {
  const [voted, setVoted] = useState<boolean | null>(null);

  return (
    <article className="space-y-6">
      {data.degraded ? (
        <Alert type="warning" title="Partial answer">
          The coach couldn’t assemble a fully sourced answer this time.
        </Alert>
      ) : null}

      {/* The answer itself, set as a piece of editorial prose. The measure is
          capped even though the column runs wider — prose wants ~64ch. */}
      <div className="max-w-[64ch] border-l-2 border-gold pl-4 sm:pl-5">
        <p className="font-display text-[1.08rem] leading-[1.65] text-ink sm:text-[1.14rem]">
          {data.answer}
        </p>
      </div>

      {/* Evidence */}
      {data.evidence.length > 0 || !data.degraded ? (
        <section>
          <SectionTitle count={`${data.evidence.length} source${data.evidence.length === 1 ? "" : "s"}`}>
            What it found
          </SectionTitle>
          <EvidenceList items={data.evidence} />
        </section>
      ) : null}

      {/* Insights */}
      {data.insights.length > 0 ? (
        <section>
          <SectionTitle>The read</SectionTitle>
          <ul className="space-y-2.5">
            {data.insights.map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-[0.9rem] leading-relaxed text-ink-2">
                <span
                  aria-hidden
                  className="mt-[9px] h-1 w-4 shrink-0 rounded-full bg-gold"
                />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Recommendations */}
      {data.recommendations.length > 0 ? (
        <section>
          <SectionTitle>What to do next</SectionTitle>
          <ol className="space-y-0">
            {data.recommendations.map((s, i) => (
              <li
                key={i}
                className={[
                  "flex items-start gap-4 py-3",
                  i > 0 ? "border-t border-line" : "",
                ].join(" ")}
              >
                <span className="mt-[3px] font-mono text-[0.7rem] font-medium tracking-[0.06em] text-gold-ink tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[0.9rem] leading-relaxed text-ink">{s}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* Follow-up */}
      {data.follow_up_question ? (
        <button
          type="button"
          onClick={() => onAskFollowUp?.(data.follow_up_question as string)}
          disabled={!onAskFollowUp}
          className="group flex w-full items-center gap-3 rounded-xl bg-surface-2 px-4 py-3.5 text-left transition-all duration-200 hover:bg-brand-soft active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50"
        >
          <svg
            className="h-4 w-4 shrink-0 text-brand transition-transform duration-200 group-hover:rotate-180"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            viewBox="0 0 24 24"
          >
            <path d="M21 12a9 9 0 1 1-9-9" />
            <path d="M21 3v6h-6" />
          </svg>
          <span className="text-[0.9rem] leading-snug text-ink-2">
            <span className="font-semibold text-ink">Ask a follow-up — </span>
            {data.follow_up_question}
          </span>
        </button>
      ) : null}

      {/* Feedback */}
      <div className="border-t border-line pt-4">
        {voted !== null ? (
          <p className="font-mono text-[0.7rem] tracking-[0.06em] text-ink-3 uppercase">
            {voted ? "Noted as accurate — thank you." : "Noted — the coach will do better."}
          </p>
        ) : (
          <FeedbackButtons onVote={(helpful) => setVoted(helpful)} />
        )}
      </div>
    </article>
  );
}
