# MVP plan (stages and gates)

Status: Stage 0. The plan below is the committed stage order; each stage closes with its gate report in `docs/stage-reports/`.

| Stage | Scope | Gate |
| --- | --- | --- |
| 0 — Bootstrap | input validation, docs suite, scaffold, CI workflows, skeleton deploy | health endpoint live, CI green, docs committed |
| 1 — Foundation | Kashi setup, RTL shell, self-hosted Vazirmatn, D1 schema + migrations, Better Auth (username only), auth pages, recovery codes | auth works on real D1, unit + integration tests green |
| 2 — Core UI | layout, navigation, dashboard shell with real empty states, UI wrappers, responsive layouts | all screens render with real states, RTL reviewed |
| 3 — Financial core | accounts, categories, people, transactions, transfers, debts, budgets + full domain tests | balances/transfers/debts correct per invariants, user isolation tested |
| 4 — Reports & settings | reports on real data, Jalali ranges, previous-period comparison, export, account deletion | reports match raw data in tests |
| 5 — Hardening & MVP release | accessibility, RTL/responsive review, security review, e2e, bundle size, final docs | acceptance criteria (below) all pass, live verification |
| 6+ — Phase 2 | recurring, planned payments, goals, assets, import/export, receipts (R2), currencies — one module per stage | own gate + redeploy each |

Gate for every stage: features work on the real database; unit, integration and component tests green; typecheck and lint clean; RTL and Persian copy checked on new screens; docs and AGENTS.md updated; everything committed and pushed; short stage report written.

## Phase 1 feature checklist

- [ ] Auth: register/login (username + password, no email), logout, protected routes, secure sessions, password reset via one-time recovery codes (8, hashed, shown once)
- [ ] Dashboard: total balance, income/expenses/net for a Jalali period, income-vs-expenses chart, category breakdown, budget utilization, recent transactions, upcoming debt due dates, quick add
- [ ] Accounts: bank/cash/wallet/savings/credit/custom, opening balance, live balance, archive, per-account page, internal transfers
- [ ] Transactions: income/expense/transfer, edit, soft delete, category, payment method, note, optional person, search, filters (date, amount, category, account, type)
- [ ] Categories: seeded Persian set, add/rename/archive
- [ ] People: optional on transactions (inline create), required on debts, person page with net balance
- [ ] Debts & receivables: بدهی من / طلب من, optional due date and installments, repayment history, remaining balance, overdue indicator, optional account link
- [ ] Budgets: monthly, per one/many categories, actual vs planned, progress bar, amber at 80%, red exceeded
- [ ] Reports: income vs expenses, category breakdown, cash flow, account balances, custom range, previous-period comparison
- [ ] Settings: profile, display unit (Toman default), theme, category management, password change, recovery-code regeneration, data export, full account deletion

## Acceptance criteria (MVP, from brief section 9)

1. Users can register and log in; each user sees only their own data.
2. Accounts, income, expenses, transfers work; balances correct; transfers never change income/expense totals.
3. Debts and receivables with people and repayments work; remaining balances correct.
4. Budgets track real spending; reports use real transactions; search and filters work.
5. Data persists after refresh and logout.
6. Whole UI Persian and RTL with Jalali dates, Persian digits, Toman default.
7. Works on desktop and mobile; every visible control does something.
8. Tests pass in CI; app live on Cloudflare, deployed from GitHub.

## Testing targets

- ≥90% line coverage on `src/shared/domain` and on worker services.
- Unit (Vitest), API/integration (`@cloudflare/vitest-pool-workers` + local D1 from real migrations), component (Testing Library), e2e (Playwright, Stage 5, environment permitting).
- Every bug fix adds a regression test. Deployment blocked when CI fails.
