# Stage 5 report — Hardening & MVP release

Date: 2026-11-27 · Branch: `main`

## Done

1. **Security headers** (brief §3.4): CSP (`default-src 'self'`, no
   external origins — fonts and styles are bundled), `x-content-type-options`,
   `referrer-policy: strict-origin-when-cross-origin`, `x-frame-options:
   DENY`, `permissions-policy` — applied to Worker responses via
   middleware and to static assets via a `_headers` file.
2. **E2E (Playwright)** — the environment allowed it: a real Chromium runs
   the full journey against `wrangler dev` (built assets + real Worker +
   real local D1 with the real migrations): register → recovery codes →
   create account → expense in three interactions → transfer (balances
   asserted exactly) → budget → report → debt with repayment →
   persistence after reload and logout → full account deletion. **8/8
   passing** (`npm run test:e2e`).
3. **Product fix found by e2e**: the entry form now defaults the account
   to the last used one (brief §5.2), matching the quick-entry flow.
4. **Bundle size**: main JS ≈ 568 KB (≈ 180 KB gzipped) + 251 KB CSS
   (≈ 40 KB gzip) with two self-hosted font families. Acceptable for an
   SPA MVP; code-splitting is a Phase 2 candidate.
5. **Accessibility/RTL review**: logical CSS properties only, visible
   focus from Kashi, 44px+ touch targets, aria-labels on icon-only
   buttons, Persian labels for screen readers (Money ships amounts in
   words), `lang="fa" dir="rtl"` at the root.
6. **Security review**: generic auth errors, no stack traces in responses,
   per-user repository scoping (integration-proven), D1 rate limiting on
   the reset flow + better-auth built-in limits in production, recovery
   codes stored as hashes only, no card CVV/PIN storage (last-4 only).

## Live verification (production, this stage)

Register → create account → expense → balances exact → reports →
preferences → export → full account deletion with session invalidation —
all green on `https://dakholvakharj.hadiheydari.workers.dev`. Password
hashing (scrypt) completed within the Workers Free CPU budget: no
CPU-limit errors appeared during live sign-up/sign-in.

## Test summary

- Vitest: **54/54** (unit + component + integration on real D1).
- Playwright e2e: **8/8**.
- Typecheck: clean (3 tsconfigs). Lint: clean.

## Gate status (final MVP gate)

| Acceptance criterion | Status |
| --- | --- |
| Register/login, per-user isolation | yes (tests + live) |
| Accounts, income, expenses, transfers; balances correct; transfers never inflate totals | yes (integration + e2e) |
| Debts/receivables with people and repayments; remaining correct | yes |
| Budgets track real spending; reports on real data; search/filters work | yes |
| Data persists after refresh and logout | yes (e2e) |
| Persian RTL UI, Jalali, Persian digits, Toman default | yes |
| Desktop + mobile; every visible control works | yes (responsive shell, no dead controls) |
| Tests pass in CI; app live on Cloudflare | yes (CI green; deploys via wrangler from the build environment — see deploy note) |

## Known limitations

- `deploy.yml` in GitHub Actions fails at the Cloudflare step because the
  repo Actions secrets `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`
  could not be set via API (the fine-grained token lacks Secrets:write).
  Fix: add the two secrets manually (Settings → Secrets and variables →
  Actions) or grant the token Secrets read/write — then every green push
  to main deploys automatically. All deploys so far were performed
  directly with wrangler from the build environment.
- The Kashi docs site was unreachable from the build environment;
  component APIs were read from the installed type definitions.
- Phase 2 (recurring, planned payments, goals, assets, import/export,
  receipts on R2, multi-currency) is not started, by design.
