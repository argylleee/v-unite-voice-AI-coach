"use client";

import { useState } from "react";

export type AskNavItem = {
  label: string;
  value: string;
  unit?: string;
  change?: string;
  changeType?: "up" | "down" | "flat";
  onClick: () => void;
};

const DELTA: Record<NonNullable<AskNavItem["changeType"]>, string> = {
  up: "text-gold-ink",
  down: "text-danger",
  flat: "text-ink-3",
};

/**
 * The coach's quick-ask nav. The four clinic figures sit beside the greeting and
 * behave like the page's own navigation: each one is a button that writes its
 * question into the composer.
 *
 * From xl up they are always on screen, because beside the greeting they cost no
 * vertical space. Below that the masthead stacks and four figures would eat most
 * of a phone screen, so they start shut behind one labelled control. The block
 * slides rather than pops: its wrapper animates grid-template-rows 0fr → 1fr with
 * opacity and visibility together, so the chips grow into place and are hidden
 * from keyboard and screen readers the moment they are closed. The note sits
 * inside the same block, so it is only ever on screen when the figures are.
 */
export function AskNav({ items }: { items: AskNavItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <nav
      aria-label="Ask the coach about a clinic figure from the last 90 days"
      className="xl:shrink-0"
    >
      <div className="mb-2.5 flex items-center justify-start gap-3 xl:justify-end">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="coach-figures"
          className="label inline-flex items-center gap-2 rounded-full bg-surface-2 px-3.5 py-2 text-[9.5px] text-ink-2 transition-all duration-300 hover:bg-brand-soft hover:text-brand active:scale-[0.97] xl:hidden"
        >
          {open ? "Hide clinic figures" : "Show clinic figures"}
          <svg
            aria-hidden
            className={[
              "h-3 w-3 transition-transform duration-300 ease-out",
              open ? "rotate-180" : "rotate-0",
            ].join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      <div
        id="coach-figures"
        className={[
          "grid transition-all duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 invisible",
          "xl:grid-rows-[1fr] xl:opacity-100 xl:visible",
        ].join(" ")}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <p className="col-span-2 mb-1 text-[0.78rem] leading-snug text-ink-3 sm:col-span-4 xl:text-right">
              <span className="font-medium text-ink-2">Select a figure</span> — it writes the prompt
              for you
            </p>

            {items.map((m) => {
              const title = [`${m.label} ${m.value}${m.unit ?? ""}`, m.change, "last 90 days"]
                .filter(Boolean)
                .join(" · ");

              return (
                <button
                  key={m.label}
                  type="button"
                  onClick={m.onClick}
                  title={title}
                  className="group flex flex-col items-start rounded-xl bg-surface-2 px-3.5 py-2.5 text-left transition-all duration-300 hover:bg-brand-soft active:scale-[0.98]"
                >
                  <span className="label text-[10px] leading-none">{m.label}</span>
                  <span className="mt-2.5 font-mono text-[1.2rem] leading-none font-medium tracking-tight text-ink tabular-nums transition-colors duration-200 group-hover:text-brand">
                    {m.value}
                    {m.unit ? (
                      <span className="ml-0.5 text-[0.7rem] text-ink-3">{m.unit}</span>
                    ) : null}
                  </span>
                  {m.change ? (
                    <span
                      className={`mt-2 font-mono text-[0.65rem] leading-none tracking-[0.04em] ${DELTA[m.changeType ?? "flat"]}`}
                    >
                      {m.changeType === "up" ? "▲ " : m.changeType === "down" ? "▼ " : ""}
                      {m.change}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
