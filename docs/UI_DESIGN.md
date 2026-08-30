# UI Design — Impeccable is mandatory for all UI work

UI/UX is only 5% of the rubric, so the goal here is not to spend disproportionate time on visual
polish — it's to avoid the specific, recognizable "AI slop" look (generic drop shadows, purple-to-
blue gradients, nested cards everywhere, Inter-everywhere typography, "AI beige" palettes, bouncy/
elastic easing) that makes a demo look unfinished even when the underlying agent is strong. The
project uses **Impeccable** (github.com/pbakaus/impeccable) to enforce this mechanically instead
of relying on taste alone under time pressure.

## Rule

**No screen ships without going through the Impeccable workflow below.** This applies to every
page in `docs/PROJECT_SPEC.md`'s required screens (`/coach`, `/knowledge`, `/sessions`, session
detail) and to any component with meaningful visual surface (chat bubbles, evidence/source cards,
voice recorder UI, action-plan display). It does not apply to internal-only, non-visual code.

## Setup (once, at the start of Phase 8 in `docs/DEVELOPMENT_PLAN.md` — install earlier if useful
for iterating on components as they're built)

Install as a Claude Code plugin (preferred for this project, since development is Claude-Code-
driven):

```
/plugin marketplace add pbakaus/impeccable
/plugin
```

or via the CLI from the repo root:

```
npx impeccable install
```

Then, once per project:

```
/impeccable init
```

This asks a few questions about the product and writes two files to the repo root —
`PRODUCT.md` (what each surface is for: persuade, help operate a task, or build understanding —
this app is almost entirely "help operate a task") and `DESIGN.md` (the design tokens, components,
and brand rules the agent should inherit rather than reinvent per screen). Commit both files;
treat `DESIGN.md` as the single source of visual truth for the project the same way `CLAUDE.md` is
for architecture — don't let individual screens drift from it.

## Workflow

1. **`/impeccable shape`** — plan a screen's UX/UI before writing code, for anything nontrivial
   (the `/coach` screen, the voice interaction state machine in `docs/VOICE.md`).
2. Build the screen.
3. **`/impeccable critique`** — a UX design review pass.
4. **`/impeccable audit`** — technical quality: accessibility, performance, responsiveness.
5. **`/impeccable polish`** — final alignment pass against `DESIGN.md`.

Narrower commands (`/impeccable typeset`, `/impeccable colorize`, `/impeccable animate`,
`/impeccable distill`) are available for targeted refinement and can be pinned as shortcuts
(`/impeccable pin polish` → `/polish`) if used often.

## Automated gate

Impeccable ships a standalone detector with 59 deterministic anti-pattern rules, independent of
any AI call:

```
npx impeccable detect src/
npx impeccable detect --json .
```

Add this as a CI job once `src/` actually contains UI (Phase 8 onward — see the commented-out job
in `.github/workflows/ci.yml`) so a generic-looking component can't merge silently. Until then,
running it locally after each UI change is enough.

## What "no AI slop" concretely means here

- No decorative complexity that doesn't serve the "help operate a task" goal from `PRODUCT.md` —
  this is a coaching tool an owner uses to make decisions, not a marketing page.
- Evidence and source citations (`docs/RAG.md`, `docs/AI_AGENT.md`) must be visually legible, not
  buried — they're the part of the UI that actually demonstrates the agent's reasoning to an
  evaluator, which is worth more (via the 18%/12% rubric lines they support) than any amount of
  decorative styling.
- Respect `DESIGN.md`'s tokens once `/impeccable init` has generated them — don't introduce a new
  ad hoc color or shadow style per component.
- Every async state required by `docs/VOICE.md` and the frontend skill (`idle`, `loading`,
  `error`, `recording`, `transcribing`, `thinking`, `speaking`) needs an actual designed state, not
  a bare spinner bolted on at the end.
