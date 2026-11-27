# Stage 0 report — Bootstrap

Date: 2026-11-27 · Commit range: `1fe2da0..9b42420` + report commit · Branch: `main`

## Done

1. **Input validation**
   - GitHub token: VALID (fine-grained, user `hadiheydari-git`), repo `hadiheydari-git/hesabketab` reachable, empty (size 0), push/admin permissions confirmed.
   - Cloudflare token: **INVALID** — `GET /user/tokens/verify` returns `1000 "Invalid API Token"` (revoked, rotated, or mistyped). All Cloudflare-dependent steps paused, nothing faked.
   - `@kashi-ui/*` packages verified on npm: all six exist, latest `2.17.0` — Stage 1 design-system work unblocked.
2. **Docs before code** (commit `1fe2da0`): architecture, routes, schema ERD, component hierarchy, MVP plan, copy guide, design system, deploy runbook, ADR-0001 (workers.dev URL), ADR-0002 (worker name/title), AGENTS.md, README.md.
3. **Scaffold** (commit `9b42420`): TypeScript strict (3 tsconfigs), Vite 8 + `@cloudflare/vite-plugin` (explicit absolute `configPath` — the plugin only searches the Vite root for `wrangler.jsonc`), React 19 + Hono 4 + wrangler 4.168, ESLint 9 flat config + Prettier, Vitest, `wrangler.jsonc` with SPA fallback + `run_worker_first: ["/api/*"]` + D1 binding + observability, `/api/health` endpoint, RTL Persian skeleton page fetching real health status.
4. **CI/CD workflows**: `ci.yml` (push/PR: typecheck, lint, test) and `deploy.yml` (push main: checks, build, D1 migrations, `wrangler deploy -c src/web/dist/dakholvakharj/wrangler.json` — verified via dry-run that the generated dist config is the deployable one).
5. **Live verification of deploy dry-run**: worker bundle 60.6 KiB, 5 static assets, D1 binding resolved.

## Gate status

| Gate item | Status |
| --- | --- |
| Features work on real database | n/a in Stage 0 (health endpoint has no DB dependency) |
| Tests green | 2/2 unit tests pass (`/api/health` 200 + app title, JSON 404 envelope) |
| Typecheck clean | yes (web + worker + tooling configs) |
| Lint clean | yes (ESLint 9, flat config) |
| Docs + AGENTS.md updated | yes |
| Committed and pushed | yes — CI run on `9b42420`: **success** |
| Skeleton deployed live | **BLOCKED** (see below) |
| Stage report | this file |

## CI/CD results on first push

- `CI` workflow: **success**.
- `Deploy` workflow: steps 1–6 green (checkout → npm ci → typecheck/lint/test → build); step 7 `wrangler d1 migrations apply DB --remote` fails on the invalid Cloudflare token; step 8 deploy skipped. Expected and honest state until the token is replaced.

## Test summary

- Unit: 2 passed, 0 failed (Vitest, node environment).
- Coverage: not measured yet (targets apply from Stage 1 per mvp-plan.md).

## Blocked on the user (exact items)

1. **A valid Cloudflare API token** with Account › Workers Scripts: Edit, D1: Edit, Account Settings: Read. The current one is rejected with code 1000. Once provided: update repo secret `CLOUDFLARE_API_TOKEN` (needs the GitHub token's Secrets permission, see below) and local env, create D1, set `BETTER_AUTH_SECRET`, deploy, verify `GET /api/health`.
2. **GitHub Actions secrets not set**: the fine-grained GitHub token lacks the repository **Secrets** permission (`GET /actions/secrets/public-key` → 403 "Resource not accessible by personal access token"). Either add "Secrets: read/write" to the token, or set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` manually under repo Settings → Secrets and variables → Actions.
3. **Token rotation reminder**: both tokens were shared in plaintext inside the brief document — rotate both after the build (and ideally treat them as exposed now).

## Notes and small decisions

- Worker name `dakholvakharj`, app title constant «دخل‌وخرج» — ADR-0002.
- Public URL will be `<worker>.workers.dev` — ADR-0001 (user chose workers.dev; bare `hesabketab` is not routable).
- React Router is not installed yet (nothing to route in Stage 0); installed from Stage 2 with its current major version and docs read first.
- `@cloudflare/vitest-pool-workers` lands in Stage 1 with the D1 schema; Stage 0 tests run in plain node.
