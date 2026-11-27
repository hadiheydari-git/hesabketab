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

**MVP complete (Stages 0–5).** Live at https://dakholvakharj.hadiheydari.workers.dev

Implemented: username-only auth with 8 one-time recovery codes (no email),
accounts, 7 transaction types with atomic transfers, categories (Persian
seeds), people (طرف‌حساب‌ها), debts and receivables with repayments,
monthly budgets with utilization states, Jalali reports with
previous-period comparison, settings (display unit Toman/Rial, theme,
password change, recovery-code regeneration, JSON export, full account
deletion). Persian RTL UI, self-hosted Vazirmatn, Jalali calendar
(Saturday-start weeks), money stored as integer Rial and displayed as
Toman by default.

See `docs/mvp-plan.md` for the stage plan and `docs/stage-reports/` for
per-stage reports.

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
npm test            # vitest (unit + component + integration on real D1)
npm run test:e2e    # Playwright: full journey on wrangler dev (local D1)
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
