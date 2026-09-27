import type { ReactNode } from "react";

export const GUTTER = "px-5 sm:px-8 lg:px-12";

/* ---------------------------------------------------------------- buttons */

export const BTN_PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand shadow-[var(--shadow-1)] transition-all duration-200 hover:bg-brand-deep hover:shadow-[var(--shadow-2)] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45";

export const BTN_SECONDARY =
  "inline-flex items-center justify-center gap-2 rounded-full bg-surface-2 px-5 py-2.5 text-sm font-medium text-ink-2 transition-all duration-200 hover:bg-brand-soft hover:text-brand active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45";

export const BTN_GHOST =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-ink-2 transition-colors duration-200 hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-45";

/* ------------------------------------------------------------- containers */

export function Card({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl bg-surface shadow-[var(--shadow-1)]",
        hover ? "transition-all duration-200 hover:shadow-[var(--shadow-2)]" : "",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h3 className="font-display text-[1.02rem] font-semibold text-ink">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-[0.8rem] text-ink-3">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

/* ------------------------------------------------------------- page header */

/**
 * Editorial masthead: display heading, optional standfirst, actions right.
 * No eyebrow/kicker — the heading carries its own weight.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  meta,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className={`${GUTTER} border-b border-line pt-7 pb-6 md:pt-10 md:pb-7`}>
      {/* The masthead sits in the same column as the page body, so the title and
          everything below it share one left and one right edge. */}
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0 max-w-2xl">
            <h1 className="font-display text-[2rem] leading-[1.05] font-semibold text-ink sm:text-[2.6rem]">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-3 max-w-[62ch] text-[0.95rem] leading-relaxed text-ink-2">
                {subtitle}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2.5">{actions}</div> : null}
        </div>
        {meta ? <div className="mt-5">{meta}</div> : null}
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ badge */

export function Badge({
  children,
  variant = "neutral",
}: {
  children: ReactNode;
  variant?: "neutral" | "success" | "warning" | "danger" | "brand" | "gold";
}) {
  const styles = {
    neutral: "border-transparent bg-surface-2 text-ink-2",
    success: "border-transparent bg-brand-soft text-brand",
    warning: "border-transparent bg-warn-soft text-warn",
    danger: "border-transparent bg-danger-soft text-danger",
    brand: "border-transparent bg-brand text-on-brand",
    gold: "border-transparent bg-gold-soft text-gold-ink",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] font-mono text-[0.65rem] font-medium tracking-[0.08em] uppercase ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ alert */

export function Alert({
  type = "error",
  title,
  children,
}: {
  type?: "error" | "warning" | "info";
  title: string;
  children?: ReactNode;
}) {
  const styles = {
    error: "bg-danger-soft text-danger",
    warning: "bg-warn-soft text-warn",
    info: "bg-brand-soft text-brand",
  };
  return (
    <div role="alert" className={`rounded-xl px-4 py-3 text-sm ${styles[type]}`}>
      <p className="font-semibold">{title}</p>
      {children ? <p className="mt-0.5 opacity-90">{children}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------ empty state */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon ? (
        <div className="mb-4 text-ink-3 [&>svg]:h-9 [&>svg]:w-9">{icon}</div>
      ) : null}
      <p className="font-display text-lg font-semibold text-ink">{title}</p>
      {description ? (
        <p className="mt-2 max-w-[46ch] text-sm leading-relaxed text-ink-3">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/* --------------------------------------------------------------- feedback */

export function FeedbackButtons({ onVote }: { onVote: (helpful: boolean) => void }) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3.5 py-1.5 font-mono text-[0.68rem] font-medium tracking-[0.08em] uppercase text-ink-2 transition-all duration-200 active:scale-[0.97]";

  return (
    <div className="flex flex-wrap items-center gap-2.5" role="group" aria-label="Was this answer useful?">
      <span className="label">Accurate?</span>
      <button
        type="button"
        onClick={() => onVote(true)}
        aria-label="Yes, this answer was accurate"
        className={`${base} hover:bg-brand-soft hover:text-brand`}
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
        </svg>
        Yes
      </button>
      <button
        type="button"
        onClick={() => onVote(false)}
        aria-label="No, this answer was not accurate"
        className={`${base} hover:bg-danger-soft hover:text-danger`}
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M17 14V2M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" />
        </svg>
        No
      </button>
    </div>
  );
}
