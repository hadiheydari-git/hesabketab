# Routes

Status: Stage 0. Page routes are the committed plan from the brief (section 5.1). API endpoints become real module by module; only implemented endpoints are listed as live.

## Pages (SPA)

| Route | Page | Phase |
| --- | --- | --- |
| `/login` | ورود | 1 |
| `/register` | ثبت‌نام (recovery codes shown once) | 1 |
| `/forgot-password` | بازیابی (username + recovery code + new password) | 1 |
| `/dashboard` | خانه | 1 |
| `/transactions` | تراکنش‌ها | 1 |
| `/transactions/new` | تراکنش جدید | 1 |
| `/transactions/:id` | جزئیات تراکنش | 1 |
| `/transactions/:id/edit` | ویرایش تراکنش | 1 |
| `/accounts` | حساب‌ها | 1 |
| `/accounts/new` | حساب جدید | 1 |
| `/accounts/:id` | صفحه حساب | 1 |
| `/budgets` | بودجه‌ها | 1 |
| `/budgets/new` | بودجه جدید | 1 |
| `/budgets/:id` | صفحه بودجه | 1 |
| `/reports` | گزارش‌ها | 1 |
| `/reports/income-expenses` | درآمد و هزینه | 1 |
| `/reports/categories` | تفکیک دسته‌ها | 1 |
| `/reports/cash-flow` | جریان نقدی | 1 |
| `/reports/accounts` | مانده حساب‌ها | 1 |
| `/reports/net-worth` | خالص دارایی | 1 |
| `/debts` | بدهی و طلب | 1 |
| `/debts/new` | بدهی/طلب جدید | 1 |
| `/debts/:id` | صفحه بدهی/طلب | 1 |
| `/people` | طرف‌حساب‌ها | 1 |
| `/people/:id` | صفحه طرف‌حساب | 1 |
| `/planned-payments` (+`/new`, `/:id`) | پرداخت‌های آینده | 2 |
| `/goals` (+`/new`, `/:id`) | هدف‌ها | 2 |
| `/assets` (+`/new`, `/:id`) | دارایی‌ها | 2 |
| `/settings/profile` | نمایه | 1 |
| `/settings/preferences` | ترجیحات (unit, theme) | 1 |
| `/settings/categories` | مدیریت دسته‌ها | 1 |
| `/settings/currencies` | ارزها | 2 |
| `/settings/notifications` | اعلان‌ها | 2 |
| `/settings/security` | امنیت (password, recovery codes) | 1 |
| `/settings/data-management` | مدیریت داده‌ها (export, delete account) | 1 |

Navigation shows only implemented modules. Desktop: right-side sidebar in the brief's order. Mobile: bottom bar with four items, central «+», the rest under «بیشتر».

## API (under `/api`, Hono RPC, Zod-validated)

Live endpoints are marked. Every endpoint requires a session except auth and health. Error shape: `{ error: { code, message } }`, no stack traces.

| Endpoint | Module | Status |
| --- | --- | --- |
| `GET /api/health` | system | live (Stage 0) |
| `POST /api/auth/*` (Better Auth handlers) | auth | Stage 1 |
| `GET/POST/PATCH /api/accounts`, `GET /api/accounts/:id` | accounts | Stage 3 |
| `GET/POST /api/transactions` (+ filters), `GET/PATCH/DELETE /api/transactions/:id` | transactions | Stage 3 |
| `POST /api/transfers` (two legs, one batch) | transactions | Stage 3 |
| `GET/POST/PATCH /api/categories`, `POST /api/categories/:id/archive` | categories | Stage 3 |
| `GET/POST/PATCH /api/people`, `GET /api/people/:id` | people | Stage 3 |
| `GET/POST /api/debts`, `GET /api/debts/:id`, `POST /api/debts/:id/repayments` | debts | Stage 3 |
| `GET/POST/PATCH/DELETE /api/budgets` | budgets | Stage 3 |
| `GET /api/reports/*` (income-expenses, categories, cash-flow, accounts, net-worth) | reports | Stage 4 |
| `GET/PUT /api/settings/*` (profile, preferences) | settings | Stage 4 |
| `POST /api/settings/password`, `POST /api/settings/recovery-codes` | settings | Stage 1 / 4 |
| `GET /api/export`, `DELETE /api/account` | settings | Stage 4 |

Phase 2 endpoints (recurring, planned-payments, goals, assets, imports, attachments, currencies) are designed when each module stage starts.

## Conventions

- All request/response bodies validated by Zod schemas from `src/shared` (single source of truth).
- The web client consumes the API through the Hono RPC client typed by `AppType`.
- Pagination: cursor-based where lists can grow (transactions).
- Dates: request bodies use ISO instants or `YYYY-MM-DD` Jalali day keys as defined per schema; display is always Jalali in Asia/Tehran.
