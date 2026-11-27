# Deployment

Status: Stage 0. **Deployed and verified live** at `https://dakholvakharj.hadiheydari.workers.dev` (2026-11-27).

## Pipeline

- `ci.yml` — on every push and pull request: install, typecheck, lint, test. Node 22.
- `deploy.yml` — on push to `main`: same checks, `vite build`, `wrangler d1 migrations apply DB --remote`, then `wrangler deploy` via `cloudflare/wrangler-action@v3`. Every green push to main deploys automatically.
- Repository secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (set via the GitHub API; never printed or committed).
- Worker runtime secret: `BETTER_AUTH_SECRET` (≥32 random bytes, set with `wrangler secret put`). App base URL is set as the `APP_URL` var after the first deploy.

## Required token permissions (reminder)

- Cloudflare: Account › Workers Scripts: Edit, D1: Edit, Account Settings: Read. R2: Edit only for Phase 2 receipts. Zone/Workers Routes: Edit only if a custom domain is later connected.
- GitHub (fine-grained, this repo only): Contents, Workflows, Actions, Secrets — read/write; Metadata — read.

## Commands (local)

```sh
npm ci                     # install
npm run typecheck          # tsc for web + worker configs
npm run lint               # eslint
npm test                   # vitest
npm run build              # vite build (client + worker)
npx wrangler d1 migrations apply DB --remote   # apply D1 migrations
npx wrangler deploy        # deploy Worker + assets
npx wrangler rollback      # roll back to the previous deployment version
npx wrangler secret put BETTER_AUTH_SECRET     # rotate the auth secret
```

Wrangler reads `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the environment; never write them into files that are committed.

## Migrations

Drizzle-kit generates SQL into `drizzle/` (Stage 1+). Apply locally with `wrangler d1 migrations apply DB --local`, remotely with `--remote`. Integration tests always run against the real migrations, never ad-hoc schemas.

## Rollback and rotation

- Roll back a bad deploy: `npx wrangler rollback` (finds the previous stable version).
- Rotate the Cloudflare token: create a new token with the permissions above, update the GitHub secret `CLOUDFLARE_API_TOKEN`, re-run deploy, then revoke the old token.
- Rotate `BETTER_AUTH_SECRET`: `wrangler secret put BETTER_AUTH_SECRET` (invalidates sessions; users sign in again — announce before doing it).

## Current state (Stage 0)

- Cloudflare side: **DONE** — new account-scoped API token verified against account endpoints (`/user/tokens/verify` misleadingly returns code 1000 for account-scoped tokens; real confirmation came from successful account API calls). D1 database `dakholvakharj-db` (`13d2c38f-67bf-4fdb-9cce-edc08910dc34`, APAC) created and wired into `wrangler.jsonc`. Worker `dakholvakharj` deployed (version `56865a97`), `BETTER_AUTH_SECRET` stored via `wrangler secret put`.
- Live verification (2026-11-27): `GET /api/health` → `200 {"ok":true,"name":"دخل‌وخرج",...}`; SPA root serves RTL Persian HTML; unknown non-API paths fall back to `index.html` (200); unknown `/api/*` paths return a JSON 404.
- GitHub side: **partially blocked** — the briefing file stores the GitHub token behind a redaction placeholder, so the value is no longer available to the build environment. The `wrangler.jsonc` D1 wiring commit is ready locally; a push and setting the Actions secrets `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` need the token (with Secrets read/write) pasted again, or the two secrets can be added manually under Settings → Secrets and variables → Actions. Until the secrets exist, `deploy.yml` runs will fail at the Cloudflare step (expected).
