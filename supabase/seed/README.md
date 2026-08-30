The seed generator (TypeScript, run via `npm run seed` or similar — wire this up in Phase 1) goes
here or under `src/scripts/`. It must be deterministic (fixed random seed) and produce the
intentional treatment/conversion/rebooking patterns described in `docs/DATABASE.md`, not purely
random data — the demo scenarios in `docs/PROJECT_SPEC.md` depend on those patterns existing.
