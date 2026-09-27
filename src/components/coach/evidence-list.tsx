import type { EvidenceItem } from "@/lib/validation/agent-response";

export function EvidenceList({ items }: { items: EvidenceItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl bg-surface-2 px-4 py-5 text-center text-[0.85rem] text-ink-3">
        No supporting data was cited for this answer.
      </p>
    );
  }

  return (
    <ul className="overflow-hidden rounded-xl bg-surface-2">
      {items.map((item, i) => {
        const isDoc = item.type === "knowledge_base";
        return (
          <li
            key={i}
            className={[
              "flex items-start gap-3.5 px-4 py-3.5 transition-colors",
              i > 0 ? "border-t border-line" : "",
              "hover:bg-surface",
            ].join(" ")}
          >
            <span
              aria-hidden
              className={[
                "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md",
                isDoc ? "bg-gold-soft text-gold-ink" : "bg-brand-soft text-brand",
              ].join(" ")}
            >
              {isDoc ? (
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                  <path d="M14 2v6h6M16 13H8M16 17H8" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                  <path d="M3 3v18h18" />
                  <path d="M18 17V9M13 17V5M8 17v-3" />
                </svg>
              )}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[0.875rem] leading-relaxed text-ink">
                {isDoc ? <span className="font-display italic">“{item.description}”</span> : item.description}
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.65rem] tracking-[0.06em] uppercase">
                <span className="text-ink-3">{isDoc ? "From" : "Via"}</span>
                <span className={isDoc ? "text-gold-ink" : "text-brand"}>
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
