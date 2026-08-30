Next.js App Router routes go here: `page.tsx` (landing/redirect to `/coach`), `coach/page.tsx`,
`knowledge/page.tsx`, `sessions/page.tsx`, `sessions/[id]/page.tsx`, and `api/` route handlers
that proxy to n8n webhooks server-side (never expose n8n secrets to the client). See
`docs/ARCHITECTURE.md` and `.claude/skills/frontend/SKILL.md`.
