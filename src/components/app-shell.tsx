"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const TABS = [
  { href: "/coach", label: "Coach" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/sessions", label: "Sessions" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <div className="flex min-h-screen w-full flex-col bg-[var(--paper)] md:flex-row">
      <header className="flex shrink-0 flex-col border-[var(--rule)] bg-[var(--paper)] md:w-[var(--rail-w)] md:border-r">
        <div className="border-b border-[var(--rule)] px-5 pb-4 pt-5 md:border-b-0">
          <p className="font-mono text-[0.625rem] uppercase tracking-[0.1em] text-[var(--ink-3)]">
            V-Unite Aesthetic Clinic
          </p>
          <h1 className="mt-1.5 text-[1.05rem] font-semibold leading-tight tracking-[-0.01em] text-[var(--ink)]">
            Business Coach
          </h1>
          <p className="mt-1 text-xs leading-snug text-[var(--ink-3)]">
            Evidence-first coaching for the clinic owner
          </p>
        </div>

        <nav
          aria-label="Sections"
          className="flex gap-px overflow-x-auto border-t border-[var(--rule)] md:mt-2 md:flex-col md:gap-0 md:border-t-0"
        >
          {TABS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex min-w-max items-center border-l-2 px-5 py-2.5 text-sm transition-colors md:min-w-0",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] font-semibold text-[var(--accent-ink)]"
                    : "border-transparent text-[var(--ink-2)] hover:bg-[var(--paper-sunk)] hover:text-[var(--ink)]",
                ].join(" ")}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto hidden px-5 py-3 md:block">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.14em] text-[var(--rule-strong)]">
            Chart · v1
          </p>
        </div>
      </header>

      <main className="min-w-0 flex-1 border-[var(--rule)] md:border-l-0">{children}</main>
    </div>
  );
}
