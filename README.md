# دخل‌وخرج — HesabKetab

A Persian-first personal finance web app for Iranian users: track, budget, understand. Built as an original product (inspired by the philosophy of BudgetBakers Wallet, not a clone). Manual entry first, Iranian money habits first: Toman, Jalali dates, Iranian banks.

## Stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript (strict), shared between client and server |
| Frontend | React 19, Vite, React Router (SPA), TanStack Query, React Hook Form + Zod |
| Design system | Kashi (`@kashi-ui/*`) — RTL-first Persian design system |
| Backend | Hono on Cloudflare Workers (one Worker: `/api/*` + static SPA) |
| Database | Cloudflare D1 (SQLite) + Drizzle ORM + drizzle-kit migrations |
| Auth | Better Auth, username plugin (username + password only, no email) |
| Tests | Vitest, `@cloudflare/vitest-pool-workers`, Testing Library, Playwright (Stage 5) |
| CI/CD | GitHub Actions (`ci.yml`, `deploy.yml`) → Cloudflare |

## Status

Stage 0 (Bootstrap). See `docs/mvp-plan.md` for the stage plan and `docs/stage-reports/` for progress. Live URL: pending a valid Cloudflare API token (see `docs/deploy.md`).

## Setup

```sh
npm ci
cp .dev.vars.example .dev.vars        # local secrets (gitignored)
npm run dev                           # vite dev server + local worker + local D1
```

Environment variables / secrets:

| Name | Where | Purpose |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | `.dev.vars` (local) / Worker secret (prod) | session signing, ≥32 random bytes |
| `APP_URL` | `wrangler.jsonc` vars | trusted origin for auth cookies |
| `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | env / GitHub secrets | deploy + D1 migrations only; never committed |

## Scripts

```sh
npm run typecheck   # tsc (web + worker)
npm run lint        # eslint
npm test            # vitest
npm run build       # vite build (client + worker)
npm run deploy      # wrangler deploy (requires Cloudflare credentials in env)
```

## Documentation

- `docs/architecture.md` — system and module architecture
- `docs/routes.md` — pages and API surface
- `docs/schema.md` — planned ERD and schema conventions
- `docs/component-hierarchy.md` — UI structure and RTL rules
- `docs/design-system.md` — Kashi usage and visual rules
- `docs/copy-guide.md` — Persian copy rules and fixed glossary
- `docs/deploy.md` — pipeline, migrations, rollback, secret rotation
- `docs/mvp-plan.md` — stages, gates, acceptance criteria
- `AGENTS.md` — working rules for coding agents
