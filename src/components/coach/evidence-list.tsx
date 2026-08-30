import type { EvidenceItem } from "@/lib/validation/agent-response";

// Evidence is the part of the answer that demonstrates the agent's reasoning (docs/RAG.md,
// docs/UI_DESIGN.md) — rendered as cited entries, structured clinic data vs. a document quote.

export function EvidenceList({ items }: { items: EvidenceItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-[var(--ink-3)]">
        No supporting data was cited for this answer.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((item, i) => {
        const isDoc = item.type === "knowledge_base";
        return (
          <li key={i} className="grid grid-cols-[3.25rem_1fr] gap-x-3">
            <span className="mt-[0.1rem] font-mono text-[0.6rem] uppercase tracking-[0.12em] text-[var(--ink-3)]">
              {isDoc ? "Doc" : "Data"}
            </span>
            <div>
              <p className="text-sm text-[var(--ink)]">
                {isDoc ? <span className="italic">“{item.description}”</span> : item.description}
              </p>
              <p className="mt-0.5 font-mono text-[0.7rem] text-[var(--ink-3)]">
                {isDoc ? "source " : "via "}
                <span className="text-[var(--accent-ink)]">
                  {item.source ?? (isDoc ? "clinic knowledge base" : "clinic records")}
                </span>
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
