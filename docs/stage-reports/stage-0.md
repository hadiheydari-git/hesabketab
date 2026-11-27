# Stage 0 report — Bootstrap

Date: 2026-11-27 · Commit range: `1fe2da0..9b42420` + report commit · Branch: `main`

**Update (same day, later):** the user supplied a working Cloudflare token. All previously blocked Cloudflare steps are now complete — D1 provisioned, Worker deployed, live verification green. See "Deployment completion (update)" at the bottom.

## Done

1. **Input validation**
   - GitHub token: VALID (fine-grained, user `hadiheydari-git`), repo `hadiheydari-git/hesabketab` reachable, empty (size 0), push/admin permissions confirmed. Later (post-recycle) the briefing's token value is unavailable to the build environment (redaction placeholder on disk) — pushes and secret writes now need it pasted again.
   - Cloudflare token: first token **INVALID** (`/user/tokens/verify` → `1000 "Invalid API Token"`); replaced by the user. The replacement is a valid **account-scoped** token — `/user/tokens/verify` still returns code 1000 for it, but account-scoped endpoints (accounts, D1, Workers scripts) all succeed. Validated by real operations, not by the verify endpoint.
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
| Committed and pushed | yes — CI run on `9b42420`: **success** (the D1-wiring commit is ready locally, push pending the GitHub token) |
| Skeleton deployed live | **YES** — `https://dakholvakharj.hadiheydari.workers.dev` (see update below) |
| Stage report | this file |

## CI/CD results on first push

- `CI` workflow: **success**.
- `Deploy` workflow: steps 1–6 green (checkout → npm ci → typecheck/lint/test → build); step 7 `wrangler d1 migrations apply DB --remote` fails on the invalid Cloudflare token; step 8 deploy skipped. Expected and honest state until the token is replaced.

## Test summary

- Unit: 2 passed, 0 failed (Vitest, node environment).
- Coverage: not measured yet (targets apply from Stage 1 per mvp-plan.md).

## Blocked on the user (exact items)

1. ~~A valid Cloudflare API token~~ — **RESOLVED** (update below).
2. **GitHub Actions secrets not set** (still open): the token value is no longer available to the build environment. Either paste the fine-grained token (now with Secrets read/write) so the secrets can be set via API, or set `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` manually under repo Settings → Secrets and variables → Actions. Until then, `deploy.yml` fails at the Cloudflare step (expected).
3. **Token rotation reminder**: tokens were shared in plaintext inside the brief document and chat — rotate both after the build (and ideally treat them as exposed now).

## Notes and small decisions

- Worker name `dakholvakharj`, app title constant «دخل‌وخرج» — ADR-0002.
- Public URL will be `<worker>.workers.dev` — ADR-0001 (user chose workers.dev; bare `hesabketab` is not routable).
- React Router is not installed yet (nothing to route in Stage 0); installed from Stage 2 with its current major version and docs read first.
- `@cloudflare/vitest-pool-workers` lands in Stage 1 with the D1 schema; Stage 0 tests run in plain node.

## Deployment completion (update, 2026-11-27 later)

1. New Cloudflare token validated via account API calls (the account is account-scoped; `user/tokens/verify` is not applicable).
2. D1 database **`dakholvakharj-db`** created (`13d2c38f-67bf-4fdb-9cce-edc08910dc34`, APAC) and its id wired into `wrangler.jsonc` (placeholder removed).
3. Worker **`dakholvakharj`** deployed via `wrangler deploy -c src/web/dist/dakholvakharj/wrangler.json` — version `56865a97`, D1 binding `env.DB` resolved, 3 static assets uploaded.
4. `BETTER_AUTH_SECRET` stored as a Worker secret (48 random bytes, generated locally, never printed or committed).
5. Live verification on `https://dakholvakharj.hadiheydari.workers.dev`:
   - `GET /api/health` → `200` `{"ok":true,"name":"دخل‌وخرج","time":"…"}`
   - `/` serves the RTL Persian SPA (`lang="fa" dir="rtl"`, title «دخل‌وخرج»)
   - unknown non-API path → SPA fallback `index.html` (200)
   - unknown `/api/*` path → JSON 404 envelope

Only the GitHub-side items in the list above remain open for Stage 0.
