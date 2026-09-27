/**
 * Loading placeholders. A single `.skeleton` block shimmers; SkeletonList stacks
 * them into the ruled rows the real lists use, so a page that is still fetching
 * looks like the page it is about to become rather than a blank frame.
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`skeleton block ${className}`} />;
}

export function SkeletonList({
  rows = 4,
  topRule = true,
  label = "Loading",
}: {
  rows?: number;
  topRule?: boolean;
  label?: string;
}) {
  return (
    <ul
      className={topRule ? "border-t border-line" : undefined}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <li className="sr-only">{label}…</li>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-start gap-5 border-b border-line py-5">
          <Skeleton className="mt-1 h-8 w-16 shrink-0" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-[62%]" />
            <Skeleton className="mt-2.5 h-3 w-24" />
          </div>
          <Skeleton className="mt-1 h-5 w-24 shrink-0 rounded-full" />
        </li>
      ))}
    </ul>
  );
}
