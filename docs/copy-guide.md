# Copy guide

Status: Stage 0. This is the single source of truth for Persian UI copy. Every new screen is checked against it before its stage gate.

## Voice

Standard, neutral-polite Persian. Not colloquial, not bureaucratic. No English words in the UI. Correct half-space (نیم‌فاصله, U+200C) in compounds like می‌شود، تراکنش‌ها، دسته‌بندی. Persian punctuation: ، ؛ ؟ « ».

- Button labels are verbs: ثبت، ذخیره، افزودن حساب، حذف، انصراف.
- Page titles and labels: at most three words.
- No exclamation marks, no emojis, no marketing phrases, no lorem ipsum.
- Empty state: one short sentence + one button.
- Helper text only where mistakes are likely. Errors say what happened and what to do (e.g. «مبلغ را وارد کنید» not «خطا»).
- No filler sentences. If a sentence does not help the user decide or act, delete it.

## Fixed glossary (use exactly these, everywhere)

| English | Persian |
| --- | --- |
| Home | خانه |
| Transactions | تراکنش‌ها |
| Accounts | حساب‌ها |
| Budgets | بودجه‌ها |
| Reports | گزارش‌ها |
| Debts and receivables | بدهی و طلب |
| People | طرف‌حساب‌ها |
| Upcoming payments | پرداخت‌های آینده |
| Goals | هدف‌ها |
| Assets | دارایی‌ها |
| Settings | تنظیمات |
| Income | درآمد |
| Expense | هزینه |
| Transfer | انتقال |
| Balance | موجودی |
| Net worth | خالص دارایی |
| Category | دسته‌بندی |
| I owe | بدهی من |
| Owed to me | طلب من |
| Username | نام کاربری |
| Password | رمز عبور |
| Recovery code | کد بازیابی |

Seeded category names are fixed in the brief (section 4.3) and must not be re-worded: حقوق و دستمزد، درآمد پروژه، درآمد فریلنسری، فروش، سود سرمایه‌گذاری، هدیه، سایر درآمدها / مسکن و اجاره، خوراک و مواد غذایی، حمل‌ونقل، پوشاک، سلامت و درمان، تفریح و سرگرمی، خریدهای شخصی، قبوض و خدمات، اینترنت و ارتباطات، آموزش، اقساط و بدهی، خانواده، سایر هزینه‌ها.

Payment methods: کارت بانکی، نقد، انتقال بانکی، کارت‌به‌کارت، سایر.

## Numbers, dates, directions

- Persian digits with Persian separators: ۱٬۲۵۰٬۰۰۰ (tabular numerals). Numeric inputs accept Persian, Arabic-Indic and Latin digits and normalize to Latin before validation.
- Jalali calendar everywhere; week starts Saturday; Friday highlighted; Iranian holidays shown in calendar views (from Stage 1 via @kashi-ui/persian).
- Phone numbers, card numbers, IBAN, emails, URLs stay LTR (`dir="ltr"` or `<bdi>`), right-aligned inside RTL text.
- Username is always displayed LTR.
- Amounts: Toman by default; the word تومان/ریال follows the number. Income positive (+, green + icon/label), expense negative (−), transfers and balances neutral — never color alone.
