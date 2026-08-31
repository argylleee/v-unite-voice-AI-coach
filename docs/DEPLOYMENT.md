# Deployment

Requirement #16 in `docs/PROJECT_SPEC.md`: "a deployment/build should fail when required checks
fail." This is a specific mechanism to configure, not a natural consequence of having a CI
workflow file. **By default, Vercel's GitHub integration creates and promotes a production
deployment on every push to the default branch regardless of whether a separate GitHub Actions
workflow passed or failed** — the two systems are unrelated until you explicitly connect them.

## The mechanism: Vercel Deployment Checks

Vercel Deployment Checks hold a production deployment — it still gets built, it just isn't
aliased to your production domain — until a set of required checks pass. One check source is
**GitHub Checks**: Vercel reads your GitHub Actions job results and gates promotion on them.

### Setup (do this once, early — it's a dashboard configuration, not code)

1. Confirm the repo is linked via **Vercel for GitHub** (Project Settings → Git).
2. In **Project Settings → Environments → Production**, confirm automatic aliasing for production
   is turned on (Deployment Checks needs this to have something to gate).
3. In **Project Settings → Build & Deployment → Deployment Checks**, click **Add Checks**, choose
   **GitHub** as the provider, and select the GitHub Actions job(s) from `.github/workflows/ci.yml`
   (and `e2e.yml`, once it's producing a real check) that must pass before promotion.
4. Push to the default branch. Vercel creates the production deployment immediately but will not
   point the production domain at it until the selected GitHub check(s) report success.
5. A named GitHub Actions job is matched by name across runs — if you rename a job in the
   workflow YAML, update the Deployment Check selection to match, or it'll silently stop gating
   anything.

### What this buys you for the demo

If `npm run lint`, `npm run typecheck`, the test suite, or `npm run build` fails on the commit
Vercel just deployed, the production domain keeps serving the last good deployment instead of a
broken one — which is exactly what "a deployment should fail when required checks fail" means in
practice, and it's something you can point to and explain live if asked.

### Bypass (know this exists, don't rely on it)

**Force Promote**, from the deployment details page, skips Deployment Checks. Fine as a manual
escape hatch if you're certain a check is a false negative right before a demo; don't build a
habit around it.

## CI/CD pipeline

```
git push / PR
  -> GitHub Actions (.github/workflows/ci.yml)
       install -> lint -> typecheck -> unit tests -> integration tests -> production build
  -> (separately) .github/workflows/e2e.yml, where practical
  -> Vercel production deployment created
  -> Vercel Deployment Checks wait on the GitHub Actions result above
  -> checks green -> promoted to production domain
  -> checks red -> production domain stays on the last good deployment
```

## Environment variables on Vercel

Set only the **"Required by the deployed app"** block of `.env.example` in Project Settings →
Environment Variables, scoped to Production (and Preview, if you want preview deploys to work):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server-only; bypasses RLS) |
| `N8N_CHAT_WEBHOOK_URL` | `https://primary-production-c0ce.up.railway.app/webhook/coach` |
| `N8N_VOICE_WEBHOOK_URL` | `…/webhook/voice` |
| `N8N_KNOWLEDGE_WEBHOOK_URL` | `…/webhook/knowledge` |
| `N8N_SUMMARY_WEBHOOK_URL` | `…/webhook/summary` |
| `N8N_WEBHOOK_SECRET` | the shared bearer secret n8n validates |
| `NEXT_PUBLIC_CLINIC_ID` | `80a1c835-ed66-4c0c-8c3c-52c5e90fdbf4` |
| `NEXT_PUBLIC_CLINIC_NAME` | `V-Unite Aesthetic Clinic` |

**Do not** set `SUPABASE_DB_URL` (migrations run locally, never on Vercel) or the
n8n-reference block (model / embeddings / Fish / Groq — those live in the n8n credential store).
Never commit an actual `.env` file — see `docs/SECURITY.md`.

## Deploy runbook

One-time, in order:

1. **Import the repo** at vercel.com → New Project → `argylleee/v-unite-voice-AI-coach`. Framework
   auto-detects as Next.js; leave build/output settings default.
2. **Add the env vars** from the table above (Production scope).
3. **First deploy** runs automatically. Confirm the build succeeds and the preview URL serves
   `/coach`, `/knowledge`, `/sessions`.
4. **Wire the gate:** Project Settings → Build & Deployment → Deployment Checks → Add Checks →
   GitHub → select the **`quality`** job (from `ci.yml`) and the **`e2e`** job (from `e2e.yml`).
5. **Prove it gates:** push a commit that deliberately breaks a check — e.g. a TS error in a
   throwaway file on a branch, merged to `main` — and confirm the production domain stays on the
   previous deployment while the checks are red. Then revert.
6. **Smoke the live URL:** open the production domain, run the core journey (ask a coaching
   question → get an evidenced answer → end session → see the summary), and one voice turn.
   Point at the **Railway** n8n instance, not a local one.
