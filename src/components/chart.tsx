import type { ReactNode } from "react";

/** Shared horizontal gutter so the header rule and the page body align to the same edges. */
export const GUTTER = "px-6 md:px-10";

/** Solid primary control (teal fill, near-white label). */
export const BTN_PRIMARY =
  "inline-flex items-center justify-center rounded-[3px] bg-[var(--accent)] px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-ink)] disabled:opacity-40";

/** Quiet bordered control on paper. */
export const BTN_GHOST =
  "inline-flex items-center justify-center rounded-[3px] border border-[var(--rule-strong)] bg-[var(--paper-raised)] px-3.5 py-1.5 text-sm text-[var(--ink-2)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-ink)] disabled:opacity-40";

/**
 * The page body column. Left-anchored to the rail (not centred in a wide void); prose caps at
 * --content, lists/tables get --content-wide. Shares GUTTER with PageHeader so edges line up.
 */
export function Screen({
  children,
  width = "prose",
  className = "",
}: {
  children: ReactNode;
  width?: "prose" | "wide";
  className?: string;
}) {
  const max = width === "wide" ? "max-w-[var(--content-wide)]" : "max-w-[var(--content)]";
  return (
    <div className={`${GUTTER} py-7 md:py-9`}>
      <div className={`mx-auto ${max} ${className}`}>{children}</div>
    </div>
  );
}

/** A ruled record section headed by a tracked uppercase label (FINDINGS / ASSESSMENT / PLAN). */
export function Section({
  label,
  aside,
  children,
  className = "",
}: {
  label: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-t border-[var(--rule)] pt-3 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="record-label">{label}</h3>
        {aside ? <div className="text-xs text-[var(--ink-3)]">{aside}</div> : null}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function PageHeader({
  title,
  intro,
  actions,
}: {
  title: string;
  intro?: string;
  actions?: ReactNode;
}) {
  return (
    <div className={`border-b border-[var(--rule)] ${GUTTER}`}>
      <div className="mx-auto flex max-w-[var(--content-wide)] flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-4 pt-8 md:pt-10">
        <div className="max-w-[var(--measure)]">
          <h2 className="text-[1.6rem] font-semibold leading-tight tracking-[-0.02em] text-[var(--ink)]">
            {title}
          </h2>
          {intro ? (
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-3)]">{intro}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2 pb-0.5">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}

const PRIORITY_STYLE: Record<string, string> = {
  high: "border-[var(--danger-ink)] text-[var(--danger-ink)] bg-[var(--danger-soft)]",
  medium: "border-[var(--warn-ink)] text-[var(--warn-ink)] bg-[var(--warn-soft)]",
  low: "border-[var(--rule-strong)] text-[var(--ink-3)] bg-[var(--paper-sunk)]",
};

export function PriorityTag({ priority }: { priority: string }) {
  const p = priority in PRIORITY_STYLE ? priority : "medium";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-[3px] border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] ${PRIORITY_STYLE[p]}`}
    >
      {p}
    </span>
  );
}

export function StatusTag({
  status,
}: {
  status: "ready" | "processing" | "failed" | (string & {});
}) {
  const map: Record<string, string> = {
    ready: "border-[var(--accent)] text-[var(--accent-ink)] bg-[var(--accent-soft)]",
    processing: "border-[var(--warn-ink)] text-[var(--warn-ink)] bg-[var(--warn-soft)]",
    failed: "border-[var(--danger-ink)] text-[var(--danger-ink)] bg-[var(--danger-soft)]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[3px] border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] ${
        map[status] ?? map.processing
      }`}
    >
      {status === "processing" ? (
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full bg-current [animation:vu-pulse_1.4s_ease-in-out_infinite]"
        />
      ) : null}
      {status}
    </span>
  );
}

export function Notice({
  tone = "danger",
  title,
  children,
}: {
  tone?: "danger" | "warn" | "info";
  title: string;
  children?: ReactNode;
}) {
  const map = {
    danger: "border-[var(--danger-ink)] bg-[var(--danger-soft)] text-[var(--danger-ink)]",
    warn: "border-[var(--warn-ink)] bg-[var(--warn-soft)] text-[var(--warn-ink)]",
    info: "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-ink)]",
  } as const;
  return (
    <div role="alert" className={`rounded-[3px] border px-3.5 py-2.5 text-sm ${map[tone]}`}>
      <p className="font-semibold">{title}</p>
      {children ? <p className="mt-0.5 opacity-90">{children}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="border border-dashed border-[var(--rule-strong)] bg-[var(--paper-raised)] px-6 py-10 text-center">
      <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
      {children ? (
        <p className="mx-auto mt-1 max-w-sm text-sm text-[var(--ink-2)]">{children}</p>
      ) : null}
    </div>
  );
}
