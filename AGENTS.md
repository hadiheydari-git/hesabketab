# AGENTS.md — instructions for coding agents

Read this before writing any code. It is kept current at every stage; update it in the same commit when rules change.

## Commands

```sh
npm ci && npm run typecheck && npm run lint && npm test   # full gate, must be green before any commit to main
npm run dev        # vite dev (client + worker locally, D1 local)
npm run build      # production build to dist/
npx wrangler d1 migrations apply DB --local|remote
npx wrangler deploy
```

## Folder boundaries (hard rules)

- `src/shared/` — zod schemas, money helpers, constants, pure domain logic. No DOM, no Workers APIs, no imports from worker/web.
- `src/worker/` — Hono app. `routes/` (HTTP + validation) → `services/` (business rules) → `repo/` (Drizzle). Only repos touch the DB. May import `shared` only.
- `src/web/` — React SPA. May import `shared` and the `AppType` type from the worker entry; nothing else from worker. Features never import other features' internals, only their public `index.ts`.
- Modules live in `modules/<domain>/{routes,service,repo,*.test.ts}` (worker) and `features/<domain>/` (web). Backend modules: auth, accounts, transactions, categories, people, debts, budgets, reports, settings.
- Small files, explicit names, no dead code, no `any`, no copy-paste between modules.

## Money rules (never violate)

- Integers in minor units with explicit currency code; no floats; reject amounts above `Number.MAX_SAFE_INTEGER`.
- IRR stored in Rial; display Toman (÷10) or Rial; multiply by 10 on input. Never add/compare/convert currencies silently; conversions show rate, source, date.
- Types: INCOME, EXPENSE, TRANSFER, DEBT_BORROWED, DEBT_LENT, REPAYMENT_PAID, REPAYMENT_RECEIVED. Only INCOME/EXPENSE count in totals, budgets, category reports. Every type affects balances.
- Transfers: two legs, one `db.batch()`, shared `transfer_id`. D1 has no interactive transactions — every multi-row financial write is exactly one batch.
- Balance = opening + signed sum of non-deleted transactions (one shared function in `src/shared/domain`); cached column (if any) updated in the same batch and tested.
- Soft delete (`deleted_at`) for financial records; never hard-delete financial history.
- User isolation: every repo function takes `userId` and filters by it. Tests must prove A cannot touch B's data.
- Never store full card numbers, CVV2, PINs, banking passwords. At most last four card digits.

## Dates

Store UTC; display Jalali in Asia/Tehran. Period boundaries follow the Jalali calendar; week starts Saturday. Financial day stored as Jalali `YYYY-MM-DD` day key.

## RTL and copy

- `lang="fa" dir="rtl"`; logical CSS properties only. Sidebar right; primary figure top-right; primary button at inline-start. Mirror directional icons, not logos.
- Persian digits (tabular) with Persian separators; accept Persian/Arabic-Indic/Latin digits in inputs, normalize before validation.
- Copy per `docs/copy-guide.md` — glossary is fixed, buttons are verbs, labels ≤3 words, no exclamation marks, no English in UI, half-space correct.

## Adding a module (recipe)

1. Write the zod schemas + domain pure functions in `src/shared` with unit tests.
2. Generate/extend the Drizzle schema + migration if the module owns tables.
3. Implement repo → service → routes in `src/worker/modules/<domain>/`, each with tests (integration tests via `@cloudflare/vitest-pool-workers` on the real migrations; include user-isolation cases).
4. Build the feature in `src/web/features/<domain>/` with component tests, plus the route in `src/web/routes`.
5. Update `docs/routes.md`, `docs/schema.md` (if schema changed), this file if rules changed. Run the full gate. Conventional Commit.

## Definition of done (per stage)

Features work on the real database; unit/integration/component tests green; typecheck + lint clean; RTL and Persian copy checked on new screens; docs + AGENTS.md updated; committed and pushed; short stage report in `docs/stage-reports/`.

## Things never to do

- Never commit secrets or tokens; never log them; env vars and gitignored `.dev.vars` only.
- Never fake work: no hardcoded dashboard numbers, no dead buttons, no pretend integrations. If it cannot work yet, hide it and list it in the stage report.
- Never invent library APIs — read the installed package's docs/README first (Kashi: kashi.sepantapouya.com).
- Never seed production data; demo data only via local seed script on a flagged demo user.
- Never weaken password hashing to fit the CPU limit — report the need for Workers Paid instead.
- Never ask for or store an email or phone number for auth. Username + password only; generic login errors.
- Phase 3 ideas (AI, bank integrations, sync) are docs-only; no placeholder controls in the UI.
