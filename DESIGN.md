<!-- impeccable:design-schema 1 -->
<!-- seed d58f76c2 · form #6 clinical chart / medical record · revamp: warm editorial instrument · harbour blue + gold -->

# V-Unite Coach — Design

The source of truth for tokens and components. Inherit this per screen; don't reinvent.

## Thesis

The coach is read as a **premium clinic decision instrument** — warm paper, harbour blue, gold
hairlines, and Fraunces setting every heading. It must feel like an aesthetic clinic's own
ledger, not a generic AI chat. A coaching answer is a ruled record with three named sections —
**What it found / The read / What to do next** — and its evidence is cited like lab values. The
clinic's four headline figures sit beside the greeting and behave like navigation: each one is a
button that writes its own question into the composer.

## World

- **Surface:** warm paper (`--paper`), white and oat raised surfaces, hairline rules
  (`--line`, `--line-2`), a faint fixed paper grain. Harbour blue is the only primary; gold is a
  *hairline* value — rules, ticks and highlights — with a darker `gold-ink` reserved for anything
  set as text.
- **Dark mode:** the "evening ledger" — every token re-pointed on `html.dark`, no component
  changes. Owners work after hours.
- **Type:** two families only. **Fraunces** (`--font-display`) for every heading, the tagline and
  display figures; **Public Sans** for everything else. `--font-mono` deliberately aliases Public
  Sans so numbers stay tabular without a third family. Times New Roman survives only as the
  last-resort serif in the display stack.
- **Structure:** sections separated by tracked uppercase labels on a hairline (`.label` + `.rule`).
  Mobile gets a fixed bottom tab bar (thumb-reachable, safe-area padding) and a slim top bar.
  Desktop gets a collapsible left rail. Content columns cap at `max-w-4xl` inside `GUTTER`.
- **Motion:** sidebar and figure rail collapse over 300ms; the figures block grows from
  `grid-template-rows: 0fr`; the active nav item draws its gold tick in; answers rise in;
  skeletons shimmer. All of it shuts off under `prefers-reduced-motion`.
- **Logo:** a solid two-tone V split at its fold — brand ink on the left, gold on the right, so
  the "unite" is the join itself. Drawn, not picked; `src/app/icon.svg` carries it as the favicon.

## Tokens

Defined in `@theme` in `src/app/globals.css`; dark overrides on `html.dark`.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--color-paper` | `#faf7f2` | `#10171f` | page ground (+ fixed grain) |
| `--color-surface` | `#ffffff` | `#161f29` | rail, header, cards, composer |
| `--color-surface-2` | `#f4eee4` | `#1c2733` | pills, hover ground, skeletons |
| `--color-line` | `#e7ded1` | `#273442` | hairline dividers, default border |
| `--color-line-2` | `#d5c9b7` | `#37485a` | stronger border, scrollbar |
| `--color-ink` | `#141d26` | `#e8eef5` | primary text |
| `--color-ink-2` | `#465666` | `#b0c0cf` | secondary text |
| `--color-ink-3` | `#7c8a99` | `#7a8a9a` | labels, metadata, inactive tabs |
| `--color-brand` | `#1f4f7c` | `#7db1e4` | primary action, focus ring, active icons |
| `--color-brand-soft` | `#e5edf6` | `#16293d` | active nav ground, hover ground |
| `--color-on-brand` | `#f5f9fd` | `#0b1520` | text on brand fill |
| `--color-gold` | `#c9a96e` | `#d9bc7a` | decorative rules, ticks, selection marks |
| `--color-gold-ink` | `#8a6a28` | `#ddc288` | gold that passes as text |
| `--color-gold-soft` | `#f7efdd` | `#2b2618` | `DATA + DOCS`-style tag fill |
| `--color-danger` / `-soft` | `#b23c30` / `#fbeeea` | `#ef9b8f` / `#3a1f1b` | errors, high priority |
| `--color-warn` / `-soft` | `#9a6b06` / `#fbf3e0` | `#e0b45c` / `#332a16` | partial answers, medium priority |
| `--radius` | `14px` | same | base radius for raised surfaces |
| `--shell-top` / `--shell-bottom` | `64px` / `68px` (0 from `md`) | same | mobile chrome a full-height screen must subtract |

## Components

`src/components/chart.tsx` — shared primitives:

- **`GUTTER`** — the single horizontal padding string (`px-5 sm:px-8 lg:px-12`).
- **`BTN_PRIMARY`, `BTN_SECONDARY`, `BTN_GHOST`** — the only three button weights. Same height,
  same radius; hierarchy comes from fill, not size.
- **`PageHeader({ title, subtitle?, meta? })`** — Fraunces `h1` (`41.6px` desktop / `32px`
  mobile) over a short `ink-2` lede; `meta` renders right of the title from `lg` up.
- **`Card`, `CardHeader`, `CardBody`** — the raised surface, used for every list row.
- **`Badge`, `Alert`, `EmptyState`, `FeedbackButtons`** — status pill, `role="alert"` notice with
  `title`/`type`, ruled empty state, thumbs pair.

`src/components/app-shell.tsx` — the shell around every screen:

- **Desktop rail** — `248px` expanded / `88px` collapsed, persisted to `localStorage` under
  `v-unite-nav` and applied after mount so the server render stays deterministic. The toggle sits
  in the masthead (`aria-controls="primary-sidebar"`). While collapsing, the wordmark, nav labels
  and tagline animate width and opacity together; the rail icons sit at `x=35` either way, so the
  rail closes *around* them instead of shifting them. Nav items draw a gold tick (`scale-y`) as
  they become active.
- **Mobile** — top bar (logo + theme) and a three-tab bottom bar with `safe-area-inset-bottom`.
  The active tab's gold rule draws across (`scale-x`) and the icon pops to `scale-110`.
- **Route loading** — navigation is intercepted by the shell, which renders `RouteLoading` in
  `<main>` after a 160ms grace period and drops it the moment the URL actually moves. A safety
  timer means a dead fetch can never hang the app. `src/app/loading.tsx` wraps the same component
  for a server-rendered first paint.

`src/components/coach/ask-nav.tsx` — the figure rail:

- From `xl` the four figures sit **beside** the greeting with the note above them, right-aligned.
  Below `xl` the masthead stacks, so they start shut behind one labelled control and grow from
  `grid-template-rows: 0fr → 1fr` with opacity and `visibility` together — unreachable to keyboard
  and screen readers while shut. The note lives **inside** that block, so it is only ever on
  screen when the figures are, and it sits *after* the toggle so the toggle never moves.

Coach (`src/components/coach/`):

- **`CoachView`** — `h-[calc(100dvh-var(--shell-top)-var(--shell-bottom))]` column: masthead (with
  `AskNav`), scrolling feed, pinned composer. Empty feed shows **`SuggestedQuestions`**; once there
  is a turn or an error the masthead gains **End & summarise** and **New chat**, which resets the
  thread locally (never touches the session) so prompts come back after a failure.
- **`SuggestedQuestions`** — three ruled groups (Sales & conversion / Retention & follow-up /
  Clinic knowledge), numbered `01…`, hybrid data+docs questions carrying a gold `DATA + DOCS` tag.
- **`CoachAnswer`** — lead paragraph → **What it found** (`EvidenceList`, source count in the
  title) → **The read** → **What to do next** (numbered) → follow-up chip → `FeedbackButtons`.
  `degraded` renders `Alert type="warning"` first. Sections rise in on entry.
- **`EvidenceList`** — ruled rows, icon + quote/description + a `label` source line; customer data
  and knowledge-base citations told apart by icon, not by colour alone.
- **`Thinking`**, **`VoiceRecorder`** — animated scan bar / pulsing waveform with `M:SS` timer.

Knowledge and Sessions (`src/components/knowledge/`, `src/components/sessions/`):

- **`KnowledgeView`** — segmented drag-drop zone, document rows with file type, progress while
  `processing`, delete action.
- **`SessionsView`** — segmented filter (All / Summarised / Open) below the header, ruled session
  rows, `Card`-based.
- **`SessionDetailView`** — summary, key findings, action plan, transcript; loads behind
  `SkeletonList`.

Loading states (`src/components/skeleton.tsx`):

- `.skeleton` (globals.css) is the one shimmering placeholder; `Skeleton` and `SkeletonList` shape
  it. Sessions, Knowledge and session detail render these instead of "Loading…" text.

## Screen inventory

| Route | Component | Notes |
|---|---|---|
| `/` | — | `redirect("/coach")` |
| `/coach` | `CoachView` | Figure rail, prompt index, feed, composer. Voice + text equal. |
| `/knowledge` | `KnowledgeView` | Drag-drop + document list + coverage summary. |
| `/sessions` | `SessionsView` | Ruled list with segmented filter. |
| `/sessions/[id]` | `SessionDetailView` | Summary → findings → action plan → transcript. |

## Accessibility & finish

- `:focus-visible` — 2px `brand` outline, 2px offset, globally.
- `prefers-reduced-motion: reduce` kills animation and transition.
- `role="alert"` on every `Alert`; `aria-live` / `role="status"` on thinking and loading states.
- `aria-current="page"` on the active tab; `aria-expanded` + `aria-controls` on both collapsibles.
- Nav labels stay mounted when collapsed (width `0`, opacity `0`) so screen readers keep the name.
- The figure block uses `visibility`, not `display`, so shut content leaves the tab order.
- Tabular figures (`font-variant-numeric`) on every numeral; `label` carries case and tracking.
- Touch targets ≥ 44px; `active:scale` press states.
- Two fonts, two button weights, hairlines never thicker than 1px.

## Verification

`npx tsc --noEmit`, `npx next lint --dir src --dir tests`, `npx vitest run` (98 tests) and
`npx impeccable detect src/` all clean at the time of writing. The UI was additionally driven in
a real browser at 390 / 828 / 1024 / 1280 / 1440 in light and dark: no horizontal overflow, no
template copy, exactly two font families, the figure rail and its note show and hide together,
both rails collapse to their stated widths, the composer stays on screen, and the route loading
screen renders while a navigation is genuinely in flight.
