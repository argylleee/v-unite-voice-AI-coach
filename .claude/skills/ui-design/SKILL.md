---
name: ui-design
description: Use before, during, and after building any UI screen or visual component — mandatory design-quality gate to avoid generic "AI slop" output.
---

# UI Design — Impeccable workflow

Full detail: `docs/UI_DESIGN.md`. This skill is the operational trigger for that rule.

## When this applies

Any page in `docs/PROJECT_SPEC.md`'s required screens, or any component with real visual surface
(chat bubbles, evidence/source cards, voice recorder UI, action-plan display). Not internal-only,
non-visual code.

## Do this, in order

1. If not already done this project: install Impeccable
   (`/plugin marketplace add pbakaus/impeccable` then `/plugin`, or `npx impeccable install`),
   then run `/impeccable init` once to generate `PRODUCT.md` and `DESIGN.md`. Treat `DESIGN.md`
   as the source of truth for tokens/components — inherit it, don't reinvent per screen.
2. For a nontrivial screen: `/impeccable shape` before writing code.
3. Build the screen.
4. `/impeccable critique` (UX review), then `/impeccable audit` (accessibility, performance,
   responsiveness), then `/impeccable polish` (final alignment pass).
5. Before calling any UI work done, run the standalone detector:
   `npx impeccable detect src/` — zero unaddressed findings, or an explicit, justified exception.

## Hard no's (Impeccable's own anti-pattern list — don't reintroduce these by hand)

Generic drop shadows, purple-to-blue gradients, nested cards everywhere, "AI beige" palettes,
overused/default fonts (Inter-everywhere), gray text on colored backgrounds, dated
bounce/elastic easing.

## Reminder on scope

UI/UX is 5% of the rubric. This skill exists so design quality is enforced quickly and
mechanically, not so disproportionate time gets spent on it — see `docs/DEVELOPMENT_PLAN.md`
Phase 8.
