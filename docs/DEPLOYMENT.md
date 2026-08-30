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

Set every variable from `.env.example` in Project Settings → Environment Variables, scoped
appropriately (Production / Preview / Development). Never commit an actual `.env` file — see
`docs/SECURITY.md`.
