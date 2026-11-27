# Stage 4 report — Reports & settings

Date: 2026-11-27 · Branch: `main`

## Done

1. **Reports on real data** (`GET /api/reports/summary?fromDay&toDay`):
   income/expense/net for any Jalali range, previous-period comparison of
   equal length, per-category breakdown (named), per-day cash flow, and
   account balances. Only INCOME/EXPENSE feed totals (transfer-neutrality
   re-proven by an integration test that adds a transfer and asserts the
   totals do not move).
2. **Reports UI**: Kashi `StatCard` grid with trend percentages, `BarList`
   for the top categories, `BarChart` for daily cash flow, account balance
   table — all with empty/loading/error states and a custom-range picker.
3. **Settings**: profile (display name; username shown LTR and marked
   immutable), preferences (display unit Toman/Rial + light/dark theme,
   applied live), security (password change verifying the current password
   through better-auth's own `verifyPassword`/`hashPassword`; one-time
   recovery-code regeneration), data management (full JSON export with a
   download header; complete account deletion in one batch with session
   invalidation). The deletion dialog requires typing «حذف حساب».
4. **Route coverage**: /reports, /settings (+ /settings/profile,
   /preferences, /categories, /security, /data-management aliases all
   rendering the hub sections).

## Test summary

- **54/54 passing** (+6): reports aggregation + previous period +
  transfer neutrality + session requirement; preferences update reflected
  in /api/me; profile rename; password change (wrong current → 401, right
  → 200, new password signs in); export contents; account deletion wipes
  every owned row and invalidates the session.

## Gate status

| Gate item | Status |
| --- | --- |
| Reports match raw data | yes (integration-tested against real transactions) |
| Export + account deletion | yes (tested + live-verified) |
| Tests green | 54/54 |
| Typecheck + lint clean | yes |
| Committed and pushed | yes (`223054f`) |
| Deployed + live-verified | yes — real report totals, prefs, export and deletion on production |
