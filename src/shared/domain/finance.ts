// Transaction type domain (brief §3.3): seven types; only INCOME and
// EXPENSE count in income/expense totals, budgets and category reports;
// every type affects account balances; transfers and debt movements must
// never inflate income or expense.

export const TRANSACTION_TYPES = [
  "INCOME",
  "EXPENSE",
  "TRANSFER",
  "DEBT_BORROWED",
  "DEBT_LENT",
  "REPAYMENT_PAID",
  "REPAYMENT_RECEIVED",
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const PAYMENT_METHODS = ["card", "cash", "bank_transfer", "card_to_card", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ACCOUNT_TYPES = ["bank", "cash", "wallet", "savings", "credit", "custom"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const DEBT_DIRECTIONS = ["borrowed", "lent"] as const;
export type DebtDirection = (typeof DEBT_DIRECTIONS)[number];

/**
 * Effect of one unit of each type on its own account's balance:
 * +1 money in, −1 money out. `amountMinor` is stored positive; the sign
 * always comes from here (single source of truth).
 */
export const TYPE_BALANCE_SIGN: Record<TransactionType, 1 | -1 | 0> = {
  INCOME: 1,
  EXPENSE: -1,
  TRANSFER: 0, // per-leg sign comes from transferLeg, not the type
  DEBT_BORROWED: 1, // cash received when taking a debt (linked account)
  DEBT_LENT: -1, // cash paid out when lending (linked account)
  REPAYMENT_PAID: -1, // paying back a debt I owe
  REPAYMENT_RECEIVED: 1, // receiving repayment of a debt owed to me
};

/** Signed effect on the leg's account for one transaction row. */
export function signedEffect(row: {
  type: TransactionType;
  transferLeg?: string | null;
}): 1 | -1 | 0 {
  if (row.type === "TRANSFER") {
    return row.transferLeg === "to" ? 1 : row.transferLeg === "from" ? -1 : 0;
  }
  return TYPE_BALANCE_SIGN[row.type];
}

/** Balance delta for a row's own account (amount × sign). */
export function balanceDelta(row: { type: TransactionType; amountMinor: number; transferLeg?: string | null }): number {
  return signedEffect(row) * row.amountMinor;
}

/** Only these two types inflate income/expense totals, budgets and category reports. */
export function countsAsIncomeOrExpense(type: TransactionType): boolean {
  return type === "INCOME" || type === "EXPENSE";
}

export type TxLike = { type: string; amountMinor: number; deletedAt: Date | null };

/** Sum of signed, non-deleted transaction amounts of one account. */
export function signedSum(rows: readonly TxLike[]): number {
  let sum = 0;
  for (const row of rows) {
    if (row.deletedAt) continue;
    if (!TRANSACTION_TYPES.includes(row.type as TransactionType)) continue;
    sum += balanceDelta(row as never);
  }
  return sum;
}

/**
 * Account balance invariant (brief §3.3): opening balance + signed sum of
 * non-deleted transactions — the single shared function every caller
 * (service, cache refresh, tests) must use.
 */
export function computeAccountBalance(
  openingBalanceMinor: number,
  rows: readonly TxLike[],
): number {
  const balance = openingBalanceMinor + signedSum(rows);
  if (!Number.isSafeInteger(balance)) throw new Error("balance out of safe integer range");
  return balance;
}

/* ─────────── Budgets ─────────── */

export type BudgetState = "ok" | "warning" | "exceeded";

/**
 * Budget utilization: actual (EXPENSE-only sum in the budget's categories
 * for the Jalali month) vs limit. Amber at ≥80%, red above 100%.
 */
export function budgetUtilization(actualMinor: number, limitMinor: number) {
  const percent = limitMinor === 0 ? (actualMinor > 0 ? 100 : 0) : (actualMinor / limitMinor) * 100;
  const state: BudgetState = actualMinor > limitMinor ? "exceeded" : percent >= 80 ? "warning" : "ok";
  return {
    percent,
    state,
    remainingMinor: limitMinor - actualMinor,
  };
}

/* ─────────── Debts ─────────── */

export type DebtLike = { id?: string; direction: string; principalMinor: number };
export type RepaymentLike = { type: string; amountMinor: number; debtId: string | null; deletedAt: Date | null };

/**
 * Remaining balance of a debt: principal − valid repayments of the
 * matching direction (borrowed → REPAYMENT_PAID, lent →
 * REPAYMENT_RECEIVED). When `debt.id` is set, only repayments pointing at
 * that debt count. Never below zero.
 */
export function debtRemainingMinor(
  debt: DebtLike,
  repayments: readonly RepaymentLike[],
): number {
  const expected = debt.direction === "borrowed" ? "REPAYMENT_PAID" : "REPAYMENT_RECEIVED";
  let paid = 0;
  for (const r of repayments) {
    if (r.deletedAt || r.debtId === null) continue;
    if (r.type !== expected) continue;
    if (debt.id !== undefined && r.debtId !== debt.id) continue;
    paid += r.amountMinor;
  }
  return Math.max(debt.principalMinor - paid, 0);
}

/** A debt settles automatically when its remaining balance is zero. */
export function isDebtSettled(debt: DebtLike, repayments: readonly RepaymentLike[]): boolean {
  return debtRemainingMinor(debt, repayments) === 0;
}
