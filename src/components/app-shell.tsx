"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { RouteLoading } from "./route-loading";
import { ThemeToggle } from "./theme-toggle";

type Tab = {
  href: string;
  label: string;
  icon: string;
  icon2?: string;
};

const TABS: Tab[] = [
  {
    href: "/coach",
    label: "Coach",
    icon: "M21 12a9 9 0 1 1-4.4-7.7L21 3l-1.2 4.4A8.96 8.96 0 0 1 21 12Z",
    icon2: "M8 10h8M8 14h5",
  },
  {
    href: "/knowledge",
    label: "Knowledge",
    icon: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15Z",
  },
  {
    href: "/sessions",
    label: "Sessions",
    icon: "M12 8v4l3 3M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  },
];

/**
 * The V-Unite mark: a solid V split at its fold — the left half in brand ink, the
 * right half gold, so the "unite" is visible in the join itself. Filled rather than
 * stroked so it keeps its weight at 26px, and drawn rather than picked: the old
 * stacked-layers glyph was stock iconography, not a logo.
 */
function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className="shrink-0 text-brand"
    >
      <path d="M3 4.5 L9.4 4.5 L16 19.6 L16 27.8 L13.2 27.8 Z" fill="currentColor" />
      <path d="M16 19.6 L22.6 4.5 L29 4.5 L18.8 27.8 L16 27.8 Z" fill="var(--color-gold)" />
    </svg>
  );
}

function NavItems({
  pathname,
  variant,
  expanded = true,
  onNavigate,
}: {
  pathname: string;
  variant: "side" | "bar";
  expanded?: boolean;
  onNavigate?: (e: MouseEvent<HTMLAnchorElement>, href: string) => void;
}) {
  return TABS.map(({ href, label, icon, icon2 }) => {
    const active = pathname === href || pathname.startsWith(`${href}/`);

    if (variant === "bar") {
      return (
        <Link
          key={href}
          href={href}
          onClick={onNavigate ? (e) => onNavigate(e, href) : undefined}
          aria-current={active ? "page" : undefined}
          className={[
            "relative flex flex-1 flex-col items-center justify-center gap-1 pt-2.5 pb-2 transition-colors duration-300",
            active ? "text-ink" : "text-ink-3",
          ].join(" ")}
        >
          {/* The rule draws itself across the top of the tab you picked. */}
          <span
            aria-hidden
            className={[
              "absolute inset-x-4 top-0 h-px origin-center bg-gold transition-all duration-300 ease-out",
              active ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0",
            ].join(" ")}
          />
          <svg
            aria-hidden
            className={[
              "h-[22px] w-[22px] transition-transform duration-300 ease-out motion-reduce:transition-none",
              active ? "scale-110" : "scale-100",
            ].join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={active ? 1.9 : 1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <path d={icon} />
            {icon2 ? <path d={icon2} /> : null}
          </svg>
          <span className="label text-[10px] tracking-[0.1em] transition-colors duration-300">
            {label}
          </span>
        </Link>
      );
    }

    return (
      <Link
        key={href}
        href={href}
        onClick={onNavigate ? (e) => onNavigate(e, href) : undefined}
        aria-current={active ? "page" : undefined}
        title={expanded ? undefined : label}
        className={[
          "group relative flex items-center overflow-hidden rounded-[10px] py-2.5 transition-all duration-300 ease-out",
          expanded ? "gap-3 px-3" : "gap-0 px-[23px]",
          active
            ? "bg-brand-soft text-ink"
            : "text-ink-2 hover:bg-surface-2 hover:text-ink",
        ].join(" ")}
      >
        {/* The gold tick is always mounted so it can draw itself in — and out —
            instead of appearing the instant a route changes. */}
        <span
          aria-hidden
          className={[
            "absolute -left-3 h-5 w-px origin-top bg-gold transition-all duration-300 ease-out",
            expanded && active ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0",
          ].join(" ")}
        />
        <svg
          aria-hidden
          className={[
            "h-[18px] w-[18px] shrink-0 transition-all duration-300 ease-out",
            active ? "scale-110" : "scale-100",
          ].join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={active ? 1.9 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 24 24"
        >
          <path d={icon} />
          {icon2 ? <path d={icon2} /> : null}
        </svg>
        <span
          className={[
            "overflow-hidden text-[0.9rem] whitespace-nowrap transition-all duration-300 ease-out",
            expanded ? "max-w-[150px] opacity-100" : "max-w-0 opacity-0",
            active ? "font-semibold" : "font-medium",
          ].join(" ")}
        >
          {label}
        </span>
      </Link>
    );
  });
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const [navOpen, setNavOpen] = useState(true);

  // Applied after mount so the server-rendered markup stays deterministic.
  useEffect(() => {
    try {
      if (localStorage.getItem("v-unite-nav") === "collapsed") setNavOpen(false);
    } catch {
      /* first visit */
    }
  }, []);

  const toggleNav = useCallback(() => {
    setNavOpen((wasOpen) => {
      const next = !wasOpen;
      try {
        localStorage.setItem("v-unite-nav", next ? "expanded" : "collapsed");
      } catch {
        /* storage unavailable — the state still toggles for this visit */
      }
      return next;
    });
  }, []);

  /* ---- Route loading ---------------------------------------------------
     Next keeps the outgoing screen on the page while the incoming one is
     fetched, so the shell has to own the waiting state itself. `navigating`
     is set the moment a screen is chosen and cleared the moment the URL
     actually moves — i.e. it is true for exactly the work the router is
     doing. The visible screen is held back a beat after that so a
     prefetched, near-instant navigation never flashes a skeleton, and a
     safety timer means a fetch that dies can never hang the app. */
  const router = useRouter();
  const [navigating, setNavigating] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const navTimer = useRef<number | null>(null);

  const clearNavTimer = useCallback(() => {
    if (navTimer.current !== null) {
      window.clearTimeout(navTimer.current);
      navTimer.current = null;
    }
  }, []);

  useEffect(() => {
    setNavigating(false);
    clearNavTimer();
  }, [pathname, clearNavTimer]);

  useEffect(() => {
    if (!navigating) {
      setShowLoading(false);
      return;
    }
    const t = window.setTimeout(() => setShowLoading(true), 160);
    return () => window.clearTimeout(t);
  }, [navigating]);

  useEffect(() => clearNavTimer, [clearNavTimer]);

  const go = useCallback(
    (e: MouseEvent<HTMLAnchorElement>, href: string) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      if (href === pathname || navigating) return;
      e.preventDefault();
      setNavigating(true);
      router.push(href);
      clearNavTimer();
      navTimer.current = window.setTimeout(() => setNavigating(false), 8000);
    },
    [pathname, router, navigating, clearNavTimer],
  );

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-paper md:flex-row">
      {/* ---------- Desktop sidebar ---------- */}
      <aside
        id="primary-sidebar"
        className={[
          "sticky top-0 hidden h-[100dvh] shrink-0 flex-col border-r border-line bg-surface/70 backdrop-blur-sm transition-[width] duration-300 ease-out md:flex",
          navOpen ? "w-[248px]" : "w-[88px]",
        ].join(" ")}
      >
        <div
          className={[
            "flex items-center pt-6 pb-5 transition-all duration-300 ease-out",
            navOpen ? "gap-2.5 px-5" : "gap-1 px-2",
          ].join(" ")}
        >
          <Logo size={32} />
          <div
            className={[
              "min-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 ease-out",
              navOpen ? "max-w-[200px] flex-1 opacity-100" : "max-w-0 opacity-0",
            ].join(" ")}
          >
            <p className="font-display text-[1.15rem] leading-none font-semibold text-ink">
              V-Unite
            </p>
            <p className="label mt-1.5 text-[9.5px]">Aesthetic Clinic</p>
          </div>
          <button
            type="button"
            onClick={toggleNav}
            aria-expanded={navOpen}
            aria-controls="primary-sidebar"
            aria-label={navOpen ? "Collapse navigation" : "Expand navigation"}
            title={navOpen ? "Collapse navigation" : "Expand navigation"}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-3 transition-all duration-300 hover:bg-brand-soft hover:text-brand active:scale-90"
          >
            <svg
              aria-hidden
              className={[
                "h-3.5 w-3.5 transition-transform duration-300",
                navOpen ? "rotate-0" : "rotate-180",
              ].join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>

        <div className={["rule transition-all duration-300 ease-out", navOpen ? "mx-5" : "mx-3"].join(" ")} />

        <nav
          className={[
            "flex-1 space-y-1 py-5 transition-all duration-300 ease-out",
            navOpen ? "px-5" : "px-3",
          ].join(" ")}
          aria-label="Main navigation"
        >
          <NavItems pathname={pathname} variant="side" expanded={navOpen} onNavigate={go} />
        </nav>

        <div
          className={[
            "transition-all duration-300 ease-out",
            navOpen ? "px-5 pb-6" : "px-3 pb-6",
          ].join(" ")}
        >
          <div
            className={[
              "overflow-hidden transition-all duration-300 ease-out",
              navOpen ? "mb-4 max-h-32 opacity-100" : "mb-0 max-h-0 opacity-0",
            ].join(" ")}
          >
            <div className="rule mb-4" />
            <p className="font-display text-[0.9rem] leading-snug whitespace-nowrap text-ink-2 italic">
              “Understand your business.”
            </p>
          </div>
          <div className="flex items-center justify-between transition-all duration-300 ease-out">
            <span
              className={[
                "label overflow-hidden whitespace-nowrap transition-all duration-300 ease-out",
                navOpen ? "max-w-[90px] opacity-100" : "max-w-0 opacity-0",
              ].join(" ")}
            >
              Appearance
            </span>
            <span
              className={[
                "transition-all duration-300 ease-out",
                navOpen ? "mr-0" : "mr-3.5",
              ].join(" ")}
            >
              <ThemeToggle />
            </span>
          </div>
        </div>
      </aside>

      {/* ---------- Mobile top bar ---------- */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-paper/85 px-4 py-3 backdrop-blur-md md:hidden">
        <Link
          href="/coach"
          onClick={(e) => go(e, "/coach")}
          className="flex items-center gap-2.5"
        >
          <Logo size={26} />
          <span className="font-display text-base leading-none font-semibold text-ink">
            V-Unite
          </span>
        </Link>
        <ThemeToggle />
      </header>

      {/* ---------- Content ---------- */}
      <main
        className="min-w-0 flex-1 pb-[var(--shell-bottom)] md:pb-0"
        aria-busy={showLoading || undefined}
      >
        {showLoading ? <RouteLoading /> : children}
      </main>

      {/* ---------- Mobile tab bar ---------- */}
      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <NavItems pathname={pathname} variant="bar" onNavigate={go} />
      </nav>
    </div>
  );
}
