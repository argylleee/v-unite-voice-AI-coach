<!-- impeccable:design-schema 1 -->
<!-- seed d58f76c2 · form #6 clinical chart / medical record -->

# V-Unite Coach — Design

The source of truth for tokens and components. Inherit this per screen; don't reinvent.

## Thesis

The coach is read as a **clinic chart**, not a chat app. It refuses the assistant-bubble +
hero-metric arrangement. A coaching answer is a record with three ruled sections —
**Findings / Assessment / Plan** — and its evidence is cited like lab values, each carrying the
document passage or the customer-data figure it stands on. Nothing is decorative; every number is
set in mono so it reads as data.

## World

- **Surface:** ink on warm chart paper. Three paper tones (`--paper`, `--paper-raised`,
  `--paper-sunk`), hairline rules (`--rule`, `--rule-strong`), one clinical teal accent
  (`--accent` `#0f6b5f`).
- **Type:** Public Sans (a records grotesk) for all prose; Spline Sans Mono for every figure,
  unit, source label, ID, priority tag, and section divider. No Inter anywhere.
- **Structure:** sections are separated by tracked uppercase hairline dividers
  (`.record-label`), never by cards or shadows. One left binder rail (Coach / Knowledge /
  Sessions); content column capped at `--measure` (68ch).
- **Motion:** almost none. A single `vu-pulse` opacity blink on the "processing" status dot and
  a scanning bar in the thinking indicator. Full `prefers-reduced-motion` shutoff.

## Tokens

All defined on `:root` in `src/app/globals.css`. `color-scheme: light` (single committed look;
no dark theme by design decision — timed MVP, one surface).

| Token | Value | Role |
|---|---|---|
| `--paper` | `#f6f4ee` | page ground |
| `--paper-raised` | `#fffdf8` | rail, header, composer, empty-state, notices' base |
| `--paper-sunk` | `#efece3` | hover ground, low-priority tag fill |
| `--ink` | `#1e2320` | primary text |
| `--ink-2` | `#495049` | secondary text, assessment bullets |
| `--ink-3` | `#6c746c` | labels, metadata, timestamps, mono counters |
| `--rule` | `#d9d4c6` | hairline dividers, default border |
| `--rule-strong` | `#b7b0a0` | input borders, dashed empty-state border, em-dash glyphs |
| `--accent` | `#0f6b5f` | primary action fill, active-tab marker, focus ring |
| `--accent-ink` | `#0a473f` | accent text on soft ground, links, action hover |
| `--accent-soft` | `#e0eeeb` | active tab ground, `ready` / `info` tag fill |
| `--warn-ink` / `--warn-soft` | `#7c5410` / `#f4ead1` | `processing`, `medium` priority, partial-answer notice |
| `--danger-ink` / `--danger-soft` | `#8c3a33` / `#f2ded9` | `failed`, `high` priority, error notice |
| `--focus` | `#0f6b5f` | `:focus-visible` outline |
| `--rail-w` | `15rem` | binder rail width (md+) |
| `--measure` | `68ch` | reading-column cap |
| `--font-sans` | Public Sans stack | body |
| `--font-mono` | Spline Sans Mono stack | all data |

Fonts are loaded via `next/font/google` in `src/app/layout.tsx` and exposed as
`--font-public-sans` / `--font-spline-mono`.

## Components

`src/components/chart.tsx` — the shared chart primitives:

- **`Section({ label, aside?, children })`** — a ruled record section: `border-t`, a
  `.record-label` heading, optional right-aligned `aside` (e.g. "3 cited"). This is the only
  sanctioned way to group content. Do not wrap it in a card.
- **`PageHeader({ title, intro?, actions? })`** — `--paper-raised` band with a bottom rule,
  22px semibold title, `--ink-2` intro capped at `--measure`, actions pinned right.
- **`PriorityTag({ priority })`** — mono, uppercase, bordered pill. `high` → danger, `medium` →
  warn, `low` → sunk/`--ink-3`. Unknown value falls back to `medium`.
- **`StatusTag({ status })`** — mono bordered pill for document state. `ready` → accent,
  `processing` → warn + pulsing `bg-current` dot, `failed` → danger.
- **`Notice({ tone, title, children? })`** — `role="alert"` bordered block. `danger` (default) /
  `warn` / `info`. Used for load failures, submit failures, and the degraded-answer banner.
- **`EmptyState({ title, children? })`** — dashed `--rule-strong` border on `--paper-raised`,
  centred. Sessions list and knowledge list empty views.

`src/components/app-shell.tsx` — the binder rail + `<main>`. Rail is a bottom-bordered strip on
mobile (horizontal-scroll nav) and a left column on `md+`. Active tab: `--accent-soft` ground,
`--accent-ink` text, 2px `--accent` left border (`md+`), `aria-current="page"`.

Coach-specific (`src/components/coach/`):

- **`CoachAnswer`** — lead `answer` paragraph (17px) → `Section "Findings"` (`EvidenceList`) →
  `Section "Assessment"` (em-dash bullets) → `Section "Plan"` (`01`/`02` mono-numbered `ol`) →
  a `follow_up_question` button on a top rule. `degraded` → `Notice tone="warn"` first.
- **`EvidenceList`** — `[3.25rem_1fr]` grid; mono `Doc` / `Data` tag per item; document
  evidence rendered as an italic quote; `source` line in `--accent-ink`. Plain text labels, no
  glyph icons.
- **`VoiceRecorder`** — `idle` / `recording` (mono `M:SS` timer) / `error` (mic blocked → retry).
  Picks `audio/webm` then `audio/mp4` by `MediaRecorder.isTypeSupported`.
- **`Thinking({ phase })`** — one line + a `vu-scan` bar, `aria-live="polite"`. Copy per phase:
  `thinking` / `uploading` / `transcribing` / `speaking`.
- **`SuggestedQuestions`** — three labelled groups (Sales & conversion, Retention & follow-up,
  Clinic knowledge) shown only on the empty coach feed; includes the hybrid money-shot prompt.

## Screen inventory

| Route | Component | Notes |
|---|---|---|
| `/` | — | `redirect("/coach")` |
| `/coach` | `CoachView` | `h-[100dvh]` column: header / scrolling feed / pinned composer. Voice + text share one composer. "End & summarise" appears once there's a turn. |
| `/knowledge` | `KnowledgeView` | drag-drop + file input (`.pdf` / `.txt`, ≤4 MB client check); polls every 4s while any doc is `processing`; `StatusTag` per row. |
| `/sessions` | `SessionsView` | list: title / timestamp · message count / `Summarised`\|`Ended`\|`Open` tag. |
| `/sessions/[id]` | `SessionDetailView` | if summarised → Summary + Key findings + Action plan (`PriorityTag`); else a "Summarise now" action. Always shows the transcript. |

## Accessibility & finish

- `:focus-visible` ring (2px `--accent`, 2px offset) globally; every control is a real
  `<button>` / `<a>` / `<textarea>` with a label or `sr-only` label.
- `prefers-reduced-motion: reduce` kills all animation/transition.
- `role="alert"` on every `Notice`; `aria-live="polite"` on the thinking indicator;
  `aria-current` on the active tab.
- Voice answers always render the transcript text alongside the `<audio>` element — a non-audio
  path to every spoken answer.
- Tabular figures (`font-variant-numeric: tabular-nums`) on all mono text.

## Verification

`npx impeccable detect --json src/` → `[]`. `npm run build`, `npm run typecheck`,
`npm run lint`, `npm test` all clean at the time of writing.
