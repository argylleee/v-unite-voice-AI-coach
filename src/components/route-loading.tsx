import { GUTTER } from "@/components/chart";
import { Skeleton } from "@/components/skeleton";

/**
 * The route loading screen. It renders inside the shell — nav, tabs and theme
 * stay put — so a navigation never blanks the page. It is built from the same
 * gutter and column as a real page, so the masthead skeleton lines up with the
 * title it is standing in for, and it works at any width because the column is
 * fluid: large screens get the full measure, small screens the same skeleton at
 * their own width.
 */
export function RouteLoading() {
  return (
    <div
      className="min-h-[calc(100dvh-var(--shell-top)-var(--shell-bottom))]"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <header className={`${GUTTER} border-b border-line pt-7 pb-6 md:pt-10 md:pb-7`}>
        <div className="mx-auto max-w-4xl">
          <Skeleton className="h-9 w-[55%] max-w-[15rem] rounded-lg sm:h-10" />
          <div className="mt-4 space-y-2.5">
            <Skeleton className="h-3.5 w-[88%] max-w-[34rem]" />
            <Skeleton className="h-3.5 w-[62%] max-w-[24rem]" />
          </div>
        </div>
      </header>

      <div className={`${GUTTER} py-7 md:py-9`}>
        <div className="mx-auto max-w-4xl">
          <div className="mb-7 flex items-center gap-2">
            <Skeleton className="h-8 w-28 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>

          <div className="space-y-3.5">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        </div>
      </div>

      <span className="sr-only">Loading page…</span>
    </div>
  );
}
