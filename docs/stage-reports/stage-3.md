# Stage 3 report — Financial core

Date: 2026-11-27 · Branch: `main`

## Done

1. **Shared Zod schemas** (`src/shared/schemas.ts`) used by both client
   forms and worker validation, including a `.partial()`-able base for
   PATCH flows.
2. **Accounts**: create/edit/archive/soft-delete; cached
   `balance_minor` maintained by a batched recomputation statement
   (`src/worker/db/balance.ts`) that derives the balance from the single
   invariant (opening + signed sum) on every write — verified by a
   database-level test that compares cache vs computed.
3. **Transactions**: all 7 types. Transfers expand to two legs sharing a
   `transfer_id` written with both balance refreshes in ONE `db.batch()`;
   edits of transfers update both legs + refresh both accounts in one
   batch; soft delete keeps history and rebalances. Only INCOME/EXPENSE
   carry a category; debt movements never inflate income/expense (proven
   by tests). Filters: text search, type, account, category, Jalali
   from/to day, pagination.
4. **Categories**: seeded 7 income + 13 expense (per the brief), add,
   rename, archive; archived stay referenced by history.
5. **People (طرف‌حساب‌ها)**: CRUD; inline creation inside the debt dialog;
   person net position (طلب من − بدهی من) shown in the list.
6. **Debts & receivables**: بدهی من / طلب من with optional linked account
   (principal movement `DEBT_BORROWED`/`DEBT_LENT` + balance refresh in
   the same batch), optional Jalali due date, repayments capped at the
   remaining balance, automatic settle at zero, overdue indicator from
   the shared `isOverdue`.
7. **Budgets**: Jalali month key, one or many categories, limit in
   minor units; actual = EXPENSE sum in the month for those categories;
   utilization states ok/amber(≥80%)/red(>100%) from the shared pure
   function; Progress bar in the UI.
8. **Web UI**: transactions list (search + 5 filters + pagination + safe
   delete dialog), quick-entry form (amount autofocus, type segmented
   control, جزئیات بیشتر disclosure), edit form (remount-with-initial
   pattern — no setState-in-effect), accounts list/detail/archive,
   debts pages with repayment dialog, budgets with progress bars,
   people with inline create. Navigation now lists the implemented
   modules only.

## Test summary

- **48/48 passing** (was 36): +12 financial-core integration tests on the
  real Worker + real D1 — balance invariant (incl. SQL-level cache vs
  computed), transfer atomicity (two legs, one transfer id), transfer
  neutrality toward income/expense, edit/delete rebalancing, soft delete,
  same-source transfer rejection, cross-user isolation (404s and empty
  lists), debt movement + repayment + settle + over-repayment rejection,
  overdue flag, budget warning/exceeded states and transfer neutrality,
  cross-user budget category rejection, category archive behavior.

## Bug fixes discovered by tests (regression-covered)

- `"transaction"` is a reserved SQLite word — every raw reference must be
  quoted; the balance-refresh statement and all test SQL updated.
- drizzle `db.run()` is not batchable on D1 — the balance refresh is a
  batchable UPDATE builder with a correlated SQL subquery.
- `.partial()` does not exist on a refined (ZodEffects) schema — a
  `transactionPatchSchema` base object is exported for PATCH flows.
- D1 parameter limit: seed inserts are chunked (8 rows/statement) inside
  one batch.

## Gate status

| Gate item | Status |
| --- | --- |
| Balances/transfers/debts correct per invariants | yes (integration-proven, incl. DB-level check) |
| User isolation tested | yes (accounts, transactions, debts, budgets) |
| Tests green | 48/48 |
| Typecheck + lint clean | yes |
| RTL/Persian copy checked | yes (glossary per copy-guide) |
| Committed and pushed | yes (`831e4e6`) |
| Deployed + live-verified | yes — real expense on production updated the balance to exactly 4,650,000 Rial |
