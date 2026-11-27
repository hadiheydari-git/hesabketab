# Database schema

Status: Stage 0 plan. The ERD is finalized at Stage 1 together with the first Drizzle migration; every later change goes through drizzle-kit migrations in `drizzle/`.

## Conventions

- All tables: UUID primary keys (application-generated), `created_at`/`updated_at` UTC timestamps, soft delete via `deleted_at` for financial records.
- User isolation: every table that holds user data carries `user_id` (index) and every repository query filters by it.
- Money: `amount_minor` integer columns with a companion `currency` code column. IRR amounts are stored in Rial. No floats anywhere.
- Timestamps: stored UTC (ISO-8601), displayed Jalali (Asia/Tehran). "Financial day" of a transaction is stored as a Jalali `YYYY-MM-DD` day key alongside the UTC instant.
- Better Auth owns its tables (`user`, `session`, `account`, `verification`) via the Drizzle adapter; the username plugin adds the username field. Emails are never collected; if the schema requires one, a non-routable placeholder `username@users.invalid` is stored and never shown.

## Planned ERD

```mermaid
erDiagram
    USER ||--o{ APP_ACCOUNT : owns
    USER ||--o{ CATEGORY : owns
    USER ||--o{ PERSON : owns
    USER ||--o{ TRANSACTION : owns
    USER ||--o{ DEBT : owns
    USER ||--o{ BUDGET : owns
    USER ||--o{ RECOVERY_CODE : owns
    APP_ACCOUNT ||--o{ TRANSACTION : holds
    CATEGORY ||--o{ TRANSACTION : classifies
    PERSON ||--o{ TRANSACTION : involves
    PERSON ||--o{ DEBT : involves
    DEBT ||--o{ TRANSACTION : "repaid by (REPAYMENT_*)"
    BUDGET ||--o{ BUDGET_CATEGORY : covers
    CATEGORY ||--o{ BUDGET_CATEGORY : included
    TRANSACTION ||--o{ TRANSACTION : "transfer pair (transfer_id)"

    USER {
        text id PK
        text username UK "lowercase, unique CI, LTR display"
        text password_hash
        text display_unit "toman | rial, default toman"
        text theme "light | dark"
    }
    RECOVERY_CODE {
        text id PK
        text user_id FK
        text code_hash "only hashes stored"
        integer used_at "null while unused"
    }
    APP_ACCOUNT {
        text id PK
        text user_id FK
        text name
        text type "bank | cash | wallet | savings | credit | custom"
        text bank_code "nullable, Kashi bank logo"
        text card_last4 "max 4 digits, nullable"
        integer opening_balance_minor
        text currency "default IRR"
        integer balance_minor "cached, tested vs computed"
        integer archived_at "null while active"
    }
    CATEGORY {
        text id PK
        text user_id FK
        text kind "income | expense"
        text name
        text icon "nullable"
        text color "nullable, small palette"
        integer archived_at
        integer is_seed "seeded Persian categories"
    }
    PERSON {
        text id PK
        text user_id FK
        text name
        text phone "nullable, LTR"
        text note "nullable"
    }
    TRANSACTION {
        text id PK
        text user_id FK
        text account_id FK
        text type "INCOME | EXPENSE | TRANSFER | DEBT_BORROWED | DEBT_LENT | REPAYMENT_PAID | REPAYMENT_RECEIVED"
        integer amount_minor "signed by type direction"
        text currency
        text day_key "Jalali YYYY-MM-DD"
        integer occurred_at "UTC"
        text category_id FK "nullable"
        text person_id FK "nullable"
        text payment_method "card | cash | bank_transfer | card_to_card | other"
        text note "nullable"
        text transfer_id "shared by the two legs, nullable"
        text transfer_leg "from | to, nullable"
        text debt_id FK "nullable link for debt movements"
        text related_account_id FK "transfer counterparty leg"
        integer deleted_at "soft delete"
    }
    DEBT {
        text id PK
        text user_id FK
        text person_id FK
        text direction "borrowed (بدهی من) | lent (طلب من)"
        integer principal_minor
        text currency
        text account_id FK "optional linked account"
        text due_day_key "nullable, Jalali"
        integer installments "nullable"
        integer status "open | settled"
        integer deleted_at
    }
    BUDGET {
        text id PK
        text user_id FK
        text month_key "Jalali YYYY-MM"
        integer limit_minor
        text currency
        integer deleted_at
    }
    BUDGET_CATEGORY {
        text budget_id FK
        text category_id FK
    }
```

## Notes on tricky parts

- **Transfers**: stored as two `TRANSACTION` rows sharing `transfer_id` (one `transfer_leg = from`, one `= to`), written in a single `db.batch()`. Neither row is `INCOME`/`EXPENSE`, so income/expense totals stay untouched by construction.
- **Debts**: `DEBT_BORROWED`/`DEBT_LENT` record the principal (optionally moving money through the linked account); repayments are `REPAYMENT_PAID`/`REPAYMENT_RECEIVED` transactions referencing `debt_id`. Remaining balance and overdue state are computed by pure functions in `src/shared/domain` from non-deleted rows.
- **Balances**: computed = opening + signed sum of non-deleted transactions of the account. The cached `balance_minor` is updated in the same batch as any write and tested to equal the computed value.
- **Budget utilization**: sum of `EXPENSE` transactions in the budget's categories for the Jalali month, against `limit_minor`; amber at 80%, red above 100%.
- **Seeds**: Persian income/expense categories are copied to each new user at registration (`is_seed = 1`), then fully editable/archivable per user.
