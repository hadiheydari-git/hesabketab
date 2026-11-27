# ADR-0004: Test tooling versions and workers compatibility

Date: 2026-11-27 · Status: accepted

## Context

- `@cloudflare/vitest-pool-workers` 0.23.0 requires **Vitest ^4.1** (the
  project had 5.x installed; pinned down to 4.1).
- In Vitest 4 the pool is configured through the `cloudflareTest()` plugin
  (from `@cloudflare/vitest-pool-workers`), not the old `poolOptions`
  shape; module rules live under `miniflare.modulesRules`.
- The workerd build bundled with the pool supports compatibility dates up
  to **2026-08-22**, while production targets 2026-11-01.

## Decision

- Vitest is pinned to `^4.1.0`; three projects share one `vitest.config.ts`:
  `unit` (node), `component` (jsdom), `integration` (workers pool, real D1,
  real migrations applied via `applyD1Migrations` with SQL imported as text).
- `tests/wrangler.test.jsonc` mirrors production bindings but pins
  `compatibility_date: "2026-08-22"` and disables the built-in auth rate
  limiter (`AUTH_RATE_LIMIT_OFF=1`) so tests can run fast; the reset flow
  exercises its own D1-backed limiter instead.
- Better Auth's default special rules (3 sign-in/up attempts per 10s) stay
  enabled in production — they are a security feature.

## Consequences

- Integration tests run the real worker code against real migrations —
  no mocked database.
- Test/prod compatibility dates differ; keep an eye on pool-workers
  updates and re-align when workerd catches up.
