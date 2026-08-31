# Deployment

Requirement #16 in `docs/PROJECT_SPEC.md`: "a deployment/build should fail when required checks
fail." By default, Vercel's Git integration promotes a production deployment on every push to the
default branch regardless of whether your GitHub Actions checks passed — the two are unrelated
until you connect them.

## The mechanism: CI owns the deploy

Instead of Vercel auto-deploying on push and then trying to gate it after the fact, the deploy
is a **job in the CI workflow that runs only after the checks pass**:

```
push to main
  -> GitHub Actions (.github/workflows/ci.yml)
       quality job:  lint -> typecheck -> unit -> integration -> build -> impeccable detect
       e2e job:      build -> Playwright core-journey smoke
       deploy job:   needs: [quality, e2e]   (skipped if either is red)
                     vercel pull -> vercel build --prod -> vercel deploy --prebuilt --prod
  -> quality or e2e red  -> deploy job never runs -> production domain unchanged
  -> both green           -> deploy job publishes the new production deployment
```

`vercel.json` sets `git.deploymentEnabled.main = false`, so Vercel does **not** auto-deploy `main`
on push — the CI `deploy` job is the only path to production. (PR branches still get Vercel
preview deployments.)

Env vars live once in the Vercel dashboard; `vercel pull` fetches them into the CI build.

### Bypass (know it exists, don't rely on it)

A manual `vercel deploy --prod` from a laptop skips CI entirely. Fine as an emergency escape
hatch right before a demo; don't build a habit around it.

## One-time setup

### 1. Create the Vercel project

1. vercel.com -> **Add New… -> Project** -> import `argylleee/v-unite-voice-AI-coach`.
   Framework auto-detects as Next.js; leave build/output settings default.
2. Let the first deploy run (or cancel it — the CI job will deploy on the next push to `main`).

### 2. Set env vars in the Vercel dashboard

Project **Settings -> Environment Variables**, scope **Production** (add **Preview** too if you
want PR previews to function). These are the "Required by the deployed app" block of
`.env.example`:

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

**Do not** set `SUPABASE_DB_URL` (migrations run locally) or the model/embeddings/Fish/Groq keys
(those live in the n8n credential store). Never commit an actual `.env` — see `docs/SECURITY.md`.

### 3. Give CI three GitHub secrets

Locally, link the repo to the Vercel project (creates `.vercel/project.json`, which is
gitignored):

```
npx vercel link
cat .vercel/project.json     # -> "orgId" and "projectId"
```

Then vercel.com -> **Account Settings -> Tokens -> Create Token** (any scope that covers this
project).

In GitHub -> repo **Settings -> Secrets and variables -> Actions -> New repository secret**, add:

| Secret | Value |
|---|---|
| `VERCEL_TOKEN` | the token you just created |
| `VERCEL_ORG_ID` | `orgId` from `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | `projectId` from `.vercel/project.json` |

### 4. First production deploy

Push to `main`. The `deploy` job runs after `quality` + `e2e` and publishes. Open the
`*.vercel.app` URL and click through `/coach`, `/knowledge`, `/sessions`.

## Prove the gate works (requirement #16 evidence)

1. `git checkout -b test/prove-gate`
2. Add a typecheck failure: create `src/_gatecheck.ts` with
   `export const broken: number = "nope";`
3. `git commit -am "test: break typecheck to prove the deploy gate"` then
   `git checkout main && git merge test/prove-gate && git push origin main`
4. Watch **GitHub -> Actions**: the `quality` job goes **red**, and the `deploy` job shows
   **Skipped**. The Vercel production URL still serves the previous build. Screenshot this.
5. Undo: `git revert HEAD --no-edit && git push origin main` (or delete the file). Checks go
   green, `deploy` runs, production updates.

## Final live smoke

On the production `*.vercel.app` URL (not localhost), pointed at the **Railway** n8n instance:

- Ask "Which treatment has the lowest conversion?" -> CoolSculpting + a number + cited evidence.
- **End & summarise** -> session page with summary + action plan.
- One voice turn (mic -> speak -> hear the reply).
- Confirm every workflow on Railway is **Active**, including **WF-05** (`n8n/PHASE_9_ERROR_HANDLER.md`).
