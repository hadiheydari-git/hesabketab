# Deployment

Status: Stage 0. The pipeline is fully wired; **live deployment is currently blocked by an invalid Cloudflare API token** (see Current state).

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

- GitHub side: token valid, repo `hadiheydari-git/hesabketab` reachable and empty, full push/admin permissions confirmed.
- Cloudflare side: **BLOCKED** — the provided API token is rejected by `GET /user/tokens/verify` with error code **1000 "Invalid API Token"** (revoked, rotated, or mistyped). Consequences: D1 database creation, Worker deploy, `BETTER_AUTH_SECRET` storage and live verification are all paused and will NOT be faked. Everything resumes the moment a valid token is provided and `CLOUDFLARE_API_TOKEN` is updated (repo secret + local env).
