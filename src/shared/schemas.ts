// Zod schemas shared by client forms and worker validation (brief §3.1).
import { z } from "zod";
import { ACCOUNT_TYPES, DEBT_DIRECTIONS, PAYMENT_METHODS, TRANSACTION_TYPES } from "./domain/finance";

const jalaliDayKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "قالب تاریخ باید YYYY-MM-DD باشد.");
const jalaliMonthKey = z.string().regex(/^\d{4}-\d{2}$/, "قالب ماه باید YYYY-MM باشد.");
const positiveInt = z.number().int().positive().max(Number.MAX_SAFE_INTEGER, "مبلغ از بیشینهٔ مجاز بزرگ‌تر است.");

export const accountInputSchema = z.object({
  name: z.string().trim().min(1, "نام حساب الزامی است.").max(64),
  type: z.enum(ACCOUNT_TYPES),
  bankCode: z.string().trim().max(32).optional().nullable(),
  cardLast4: z
    .string()
    .trim()
    .regex(/^\d{0,4}$/, "حداکثر چهار رقم آخر کارت مجاز است.")
    .optional()
    .nullable(),
  openingBalanceMinor: z.number().int().max(Number.MAX_SAFE_INTEGER).default(0),
});

export const categoryInputSchema = z.object({
  kind: z.enum(["income", "expense"]),
  name: z.string().trim().min(1, "نام دسته‌بندی الزامی است.").max(64),
  icon: z.string().trim().max(32).optional().nullable(),
  color: z.string().trim().max(16).optional().nullable(),
});

export const personInputSchema = z.object({
  name: z.string().trim().min(1, "نام الزامی است.").max(64),
  phone: z.string().trim().max(16).optional().nullable(),
  note: z.string().trim().max(280).optional().nullable(),
});

// One transaction row as entered by the user. Transfers are expanded to
// two legs on the server; debt movements are created by the debts module.
const transactionInputBase = z.object({
    type: z.enum(TRANSACTION_TYPES),
    accountId: z.string().min(1, "حساب را انتخاب کنید."),
    toAccountId: z.string().min(1).optional(),
    amountMinor: positiveInt,
    dayKey: jalaliDayKey,
    categoryId: z.string().optional().nullable(),
    personId: z.string().optional().nullable(),
    paymentMethod: z.enum(PAYMENT_METHODS).optional().nullable(),
    note: z.string().trim().max(280).optional().nullable(),
  });

// .partial() works on the plain object; the refinements live on the full
// create schema only (PATCH validates the transfer rules in the service).
export const transactionInputSchema = transactionInputBase
  .refine((v) => v.type !== "TRANSFER" || !!v.toAccountId, {
    path: ["toAccountId"],
    message: "حساب مقصد انتقال الزامی است.",
  })
  .refine((v) => v.type !== "TRANSFER" || v.toAccountId !== v.accountId, {
    path: ["toAccountId"],
    message: "مبدأ و مقصد انتقال نمی‌توانند یکی باشند.",
  });
export const transactionPatchSchema = transactionInputBase.partial();

export const transactionFilterSchema = z.object({
  q: z.string().trim().max(120).optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  fromDay: jalaliDayKey.optional(),
  toDay: jalaliDayKey.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
});

export const debtInputSchema = z.object({
  direction: z.enum(DEBT_DIRECTIONS),
  personId: z.string().min(1, "طرف‌حساب را انتخاب کنید."),
  principalMinor: positiveInt,
  accountId: z.string().optional().nullable(),
  dueDayKey: jalaliDayKey.optional().nullable(),
  installments: z.number().int().min(1).max(360).optional().nullable(),
  note: z.string().trim().max(280).optional().nullable(),
});

export const repaymentInputSchema = z.object({
  amountMinor: positiveInt,
  accountId: z.string().optional().nullable(),
  dayKey: jalaliDayKey,
  note: z.string().trim().max(280).optional().nullable(),
});

export const budgetInputSchema = z.object({
  monthKey: jalaliMonthKey,
  limitMinor: positiveInt,
  categoryIds: z.array(z.string().min(1)).min(1, "دست‌کم یک دسته‌بندی انتخاب کنید."),
});

export type AccountInput = z.infer<typeof accountInputSchema>;
export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type PersonInput = z.infer<typeof personInputSchema>;
export type TransactionInput = z.infer<typeof transactionInputSchema>;
export type TransactionFilter = z.infer<typeof transactionFilterSchema>;
export type DebtInput = z.infer<typeof debtInputSchema>;
export type RepaymentInput = z.infer<typeof repaymentInputSchema>;
export type BudgetInput = z.infer<typeof budgetInputSchema>;
