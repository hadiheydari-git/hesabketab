# Component hierarchy

Status: Stage 0 plan, grown stage by stage. App-specific components are thin wrappers over Kashi components/tokens in `src/web/components/ui`; no other UI kit, no second icon or date library.

```mermaid
flowchart TD
    A["App (routes)"] --> G["AuthGuard"]
    G --> Shell["AppShell"]
    Shell --> SB["Sidebar (desktop, right)"]
    Shell --> BN["BottomNav (mobile, 4 items + مرکز +)"]
    Shell --> MS["بیشتر sheet (mobile overflow)"]
    Shell --> OUT["Outlet"]
    OUT --> AUTH["AuthPages: Login · Register · ForgotPassword"]
    OUT --> DASH["Dashboard"]
    OUT --> TX["Transactions: List · New/Edit Form · Detail"]
    OUT --> ACC["Accounts: List · New Form · Detail"]
    OUT --> BUD["Budgets: List · New Form · Detail"]
    OUT --> REP["Reports: IncomeExpenses · Categories · CashFlow · Accounts · NetWorth"]
    OUT --> DEBT["Debts: List · New Form · Detail + Repayments"]
    OUT --> PEO["People: List · Detail"]
    OUT --> SET["Settings: Profile · Preferences · Categories · Security · DataManagement"]
    DASH --> QC["QuickAdd (fab/+)"]
    TX --> QF["QuickExpenseFlow: amount → category chip → save"]
```

## AppShell rules (RTL, mirrored F-pattern)

- `html lang="fa" dir="rtl"`; logical CSS properties only (`inline-start`/`inline-end`), never physical left/right.
- Sidebar sits on the **right**; page title top-**right**; the single most important figure (total balance) top-right on the dashboard.
- List rows: title on the right, amount at the left end. Filters and secondary actions toward the left. Primary button first at inline-start (right) of a button group.
- Directional icons (chevrons, arrows, back, progress) are mirrored; logos are not.
- LTR islands inside RTL text (phone numbers, card numbers, IBAN, URLs) use `dir="ltr"` or `<bdi>`.

## Shared UI wrappers (`src/web/components/ui`, grown from Stage 2)

`Page` (title + content max-width ~1100) · `PageHeader` · `AmountText` (sign + Persian digits, tabular) · `JalaliDateText` · `MoneyInput` (Toman/Rial aware, Persian digit normalization, amount in words via Kashi) · `CategoryChip` · `AccountChip` (bank logo) · `EmptyState` (one sentence + one button) · `ConfirmDialog` (destructive actions) · `FilterPopover` · `Skeleton` set · toast helpers.

## Screen states (mandatory per screen)

Every screen ships with designed empty, loading (skeleton), error and confirmation states. Destructive actions ask for confirmation. Success/failure use toasts. At most five information blocks above the fold on the dashboard; advanced fields under «جزئیات بیشتر».
