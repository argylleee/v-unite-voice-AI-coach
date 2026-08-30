---
name: frontend
description: Use when building or editing Next.js/React/TypeScript UI, pages, components, or client-side state in this project.
---

# Frontend

Next.js (App Router) + TypeScript + React + Tailwind. Read `docs/ARCHITECTURE.md` and
`docs/UI_DESIGN.md` first.

## Rules

- Next.js is presentation only. No tool selection, no LLM calls, no direct AI orchestration
  logic here — that all lives in n8n (`docs/N8N.md`). Frontend code talks to n8n webhooks (or a
  thin Next.js server-side API route that forwards to one) and renders the result.
- No direct client-side Supabase calls. See `docs/ARCHITECTURE.md` decision #2 and
  `docs/SECURITY.md`.
- Component-driven, typed, minimal duplication. Don't put business logic inside page components —
  push it into `src/lib/`.
- Every asynchronous operation needs explicit `idle` / `loading` / `success` / `error` states.
  Voice additionally needs `recording` / `uploading` / `transcribing` / `thinking` / `speaking`
  (`docs/VOICE.md`).
- Suggested reusable components: `ChatMessage`, `ChatInput`, `VoiceRecorder`, `VoicePlayer`,
  `ThinkingIndicator`, `SourceCitation`, `InsightCard`, `ActionPlan`, `SessionList`,
  `DocumentUploader`.
- Mobile-responsive, accessible interactive controls (labels, focus states, keyboard operability).
- **All UI work goes through the Impeccable workflow — see `.claude/skills/ui-design/SKILL.md`
  and `docs/UI_DESIGN.md`.** Do not hand-style a screen and call it done without running
  `/impeccable critique` / `/audit` / `/polish` against it.
- Don't over-invest here relative to the rubric: UI/UX is 5% of the score. Working intelligence
  and responsiveness matter far more than visual complexity — see `docs/DEVELOPMENT_PLAN.md`
  (UI is Phase 8, after everything functional works).
