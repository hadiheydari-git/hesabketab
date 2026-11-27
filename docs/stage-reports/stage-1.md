# Stage 1 report — Foundation

Date: 2026-11-27 · Branch: `main`

## Done

1. **Kashi design system**: installed `@kashi-ui/react`, `@kashi-ui/css`,
   `@kashi-ui/persian`, `@kashi-ui/icons`, `@kashi-ui/bank-logos`
   (2.17.0). Component APIs were read from the installed type definitions
   (the docs site was unreachable from the build environment); Kashi
   covers charts too (`BarChart`, `BarList`, `ProportionBar`), so no
   second chart library is added. `KashiProvider locale="fa"` + `Toaster`
   wrap the app; `@kashi-ui/css` imported once at the entry.
2. **RTL shell + self-hosted fonts**: `vazirmatn` npm package bundled by
   Vite (no CDN), `font-feature-settings: "ss02"` for tabular Persian
   numerals, `html lang="fa" dir="rtl"` in index.html.
3. **D1 schema + migrations**: `src/worker/db/schema.ts` implements
   docs/schema.md (accounts, categories, people, transactions, debts,
   budgets, budget_categories, settings, recovery_code, rate_limit).
   Better Auth core tables were generated with the official Better Auth
   CLI (`@better-auth/cli generate`) for the installed version, then
   merged. Two migrations in `drizzle/` (0000_init, 0001_rate_limit).
4. **Better Auth**: username plugin (3–32 chars, `[a-z0-9._]`, lowercase
   normalization, immutable), emailAndPassword enabled with the
   non-routable placeholder `username@users.invalid` (never shown),
   D1-backed drizzle adapter, `databaseHooks.user.create.after` seeds the
   21 Persian categories (7 income + 13 expense per the brief) and the
   settings row (Toman/light) in a single batch.
5. **Recovery codes + password reset** (ADR-0003): 8 one-time codes
   (hashes only), `/api/auth/forgot-password` (username + code + new
   password) with D1-backed rate limiting, one atomic batch consuming the
   code, resetting the password with better-auth's own `hashPassword`, and
   revoking all sessions. `/api/recovery-codes` regenerates (session only).
6. **Auth pages**: `/login` (sign-in by username), `/register` (shows the
   8 codes once + "I saved them" gate), `/forgot-password`; RHF + Zod with
   the shared username rules; session-guarded `/dashboard` placeholder.
7. **Testing** (ADR-0004): vitest 4.1 pinned for `@cloudflare/vitest-pool-workers`
   0.23; three projects — unit (node), component (jsdom + Testing Library),
   integration (real Worker + real local D1 + real migrations).

## Test summary

- 36/36 passing: 27 unit/domain (username rules, recovery codes, money,
  Jalali day/month/week boundaries — Saturday start, balance invariant,
  transfer pairing, budget thresholds, debt remaining) + 2 component
  (login form Persian labels, validation message) + 7 integration
  (register+seeds+codes, sign-in/username + `/api/me`, generic login
  error, private endpoints 401, reset flow invalidates code+sessions and
  swaps the password, user isolation, invalid username rejected, D1 rate
  limiting on reset attempts).
- Coverage tooling: targets apply per mvp-plan (≥90% on shared/domain and
  services); to be measured from Stage 3 onward.

## Fixes discovered by tests (regression-covered)

- `toJalali` from `@kashi-ui/persian` reads **local** Date parts — day
  keys are built timezone-independently from Tehran wall-clock parts.
- D1 caps bound parameters per statement: the seed multi-row insert is
  chunked (≤8 rows × 10 columns) and sent as one batch.
- `@kashi-ui/persian`'s wildcard matcher: better-auth rate-limit
  `customRules` need `**` (multi-segment), not `*`.

## Gate status

| Gate item | Status |
| --- | --- |
| Features work on the real database | yes — integration tests run the real worker on local D1 |
| Tests green | 36/36 |
| Typecheck clean | yes (3 tsconfigs) |
| Lint clean | yes (ESLint 9 flat) |
| Docs updated | schema.md, ADR-0003, ADR-0004, this report |
| Committed and pushed | yes (after this commit) |
| Live deploy + verification | after push (wrangler deploy + live auth check) |

## Notes

- The Kashi docs site (kashi.sepantapouya.com) timed out from the build
  environment; ground truth was the installed packages' `.d.ts` files.
- `DashboardStub` is a placeholder that Stage 2 replaces with the real
  shell; no fake dashboard data is shown.
