import type { CoachApiResponse } from "@/lib/validation/agent-response";
import { Notice, Section } from "@/components/chart";
import { EvidenceList } from "./evidence-list";

export function CoachAnswer({
  data,
  onAskFollowUp,
}: {
  data: CoachApiResponse;
  onAskFollowUp?: (q: string) => void;
}) {
  return (
    <div className="space-y-4">
      {data.degraded ? (
        <Notice tone="warn" title="Partial answer">
          The coach couldn&apos;t assemble a fully sourced answer this time.
        </Notice>
      ) : null}

      <p className="max-w-[var(--measure)] text-[1.0625rem] leading-relaxed text-[var(--ink)]">
        {data.answer}
      </p>

      {data.evidence.length > 0 || !data.degraded ? (
        <Section label="Findings" aside={`${data.evidence.length} cited`}>
          <EvidenceList items={data.evidence} />
        </Section>
      ) : null}

      {data.insights.length > 0 ? (
        <Section label="Assessment">
          <ul className="max-w-[var(--measure)] space-y-1.5">
            {data.insights.map((s, i) => (
              <li key={i} className="grid grid-cols-[1rem_1fr] gap-x-2 text-sm text-[var(--ink-2)]">
                <span aria-hidden className="text-[var(--rule-strong)]">
                  —
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {data.recommendations.length > 0 ? (
        <Section label="Plan">
          <ol className="max-w-[var(--measure)] space-y-1.5">
            {data.recommendations.map((s, i) => (
              <li
                key={i}
                className="grid grid-cols-[1.5rem_1fr] gap-x-2 text-sm text-[var(--ink)]"
              >
                <span className="font-mono text-[0.75rem] text-[var(--ink-3)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      {data.follow_up_question ? (
        <button
          type="button"
          onClick={() => onAskFollowUp?.(data.follow_up_question as string)}
          disabled={!onAskFollowUp}
          className="mt-1 max-w-[var(--measure)] border-t border-[var(--rule)] pt-3 text-left text-sm text-[var(--accent-ink)] hover:text-[var(--accent)] disabled:text-[var(--ink-3)]"
        >
          <span className="record-label mr-2">Follow up</span>
          {data.follow_up_question}
        </button>
      ) : null}
    </div>
  );
}
