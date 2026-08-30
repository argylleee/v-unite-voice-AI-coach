"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CLINIC_NAME } from "@/lib/client/api";

const TABS = [
  { href: "/coach", label: "Coach" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/sessions", label: "Sessions" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[82rem] flex-col md:flex-row">
      <header className="shrink-0 border-b border-[var(--rule)] bg-[var(--paper-raised)] md:w-[var(--rail-w)] md:border-b-0 md:border-r">
        <div className="px-5 pb-3 pt-5 md:pb-5">
          <p className="record-label">V-Unite Aesthetic Clinic</p>
          <h1 className="mt-1 text-[0.95rem] font-semibold leading-tight text-[var(--ink)]">
            Business Coach
          </h1>
          <p className="mt-0.5 hidden text-xs text-[var(--ink-3)] md:block">{CLINIC_NAME}</p>
        </div>

        <nav
          aria-label="Sections"
          className="flex gap-px overflow-x-auto border-t border-[var(--rule)] md:mt-1 md:flex-col md:gap-0 md:border-t-0"
        >
          {TABS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex min-w-max items-center px-5 py-3 text-sm transition-colors md:min-w-0",
                  active
                    ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent-ink)] md:border-l-2 md:border-[var(--accent)]"
                    : "text-[var(--ink-2)] hover:bg-[var(--paper-sunk)] md:border-l-2 md:border-transparent",
                ].join(" ")}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
