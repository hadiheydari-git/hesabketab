# Stage 2 report — Core UI

Date: 2026-11-27 · Branch: `main`

## Done

1. **Layout**: `AppLayout` — right-side sidebar on desktop (mirrored
   F-pattern: title and primary figure enter at the top-right), mobile
   bottom bar with the central «+» quick entry and a «بیشتر» bottom
   sheet; content offset via logical CSS (`inset-inline-start`,
   `margin-inline-start`), no left/right properties.
2. **Navigation**: only implemented modules are listed (خانه so far, plus
   تنظیمات landing when Stage 4 ships it); the list grows with Stage 3.
3. **UI wrappers** (`src/web/components/ui`): `Page`, `PageHeader`
   (title right, primary action left end), `EmptyHint`, `MoneyText` —
   thin wrappers over Kashi components/tokens only; `MoneyText` binds the
   stored-Rial amount to the user's display unit via `/api/me` and never
   relies on color alone (sign + unit always shown by Kashi `Money`).
4. **Dashboard with real states**: `GET /api/dashboard` returns the real
   counts and the total balance computed by the shared invariant function
   (opening + signed sum). Empty state: «هنوز چیزی ثبت نکرده‌اید» with
   the exact next action (افزودن حساب or ثبت اولین تراکنش); loading shows
   skeletons; error state offers تلاش دوباره. No hardcoded numbers.
5. **Responsive**: single CSS media pair (≥768px sidebar / <768px bottom
   bar), 44px+ touch targets on the bottom bar, safe-area padding.

## Test summary

- 36/36 passing (suite unchanged in this stage; dashboard logic runs
  through the shared balance invariant already covered by unit tests).

## Gate status

| Gate item | Status |
| --- | --- |
| Screens render with real states | yes (loading / error / empty / data) |
| RTL reviewed | logical properties only; RTL mirror of nav |
| Typecheck / lint clean | yes |
| Committed and pushed | yes (`1cc6a2e`) |
| Deployed live | yes (version `8844a3c8`) |
