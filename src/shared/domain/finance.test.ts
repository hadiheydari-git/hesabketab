import { describe, expect, it } from "vitest";
import {
  balanceDelta,
  budgetUtilization,
  computeAccountBalance,
  countsAsIncomeOrExpense,
  debtRemainingMinor,
  isDebtSettled,
  signedSum,
} from "./finance";

const tx = (type: string, amountMinor: number, opts?: { transferLeg?: string | null; deletedAt?: Date | null }) => ({
  type,
  amountMinor,
  transferLeg: opts?.transferLeg ?? null,
  deletedAt: opts?.deletedAt ?? null,
});

describe("balances (single shared function)", () => {
  it("computes opening + signed sum over non-deleted rows", () => {
    const rows = [
      tx("INCOME", 1_000_000),
      tx("EXPENSE", 300_000),
      tx("INCOME", 200_000, { deletedAt: new Date() }), // ignored
    ];
    expect(computeAccountBalance(500_000, rows)).toBe(1_200_000);
  });

  it("transfers move money without touching income/expense totals", () => {
    const rows = [
      tx("TRANSFER", 400_000, { transferLeg: "from" }),
      tx("TRANSFER", 400_000, { transferLeg: "to" }),
    ];
    expect(signedSum(rows)).toBe(0); // money moved, not created
    expect(countsAsIncomeOrExpense("TRANSFER")).toBe(false);
  });

  it("balance deltas follow the type sign table", () => {
    expect(balanceDelta({ type: "INCOME", amountMinor: 10_000 })).toBe(10_000);
    expect(balanceDelta({ type: "EXPENSE", amountMinor: 10_000 })).toBe(-10_000);
    expect(balanceDelta({ type: "DEBT_BORROWED", amountMinor: 10_000 })).toBe(10_000);
    expect(balanceDelta({ type: "DEBT_LENT", amountMinor: 10_000 })).toBe(-10_000);
    expect(balanceDelta({ type: "REPAYMENT_PAID", amountMinor: 10_000 })).toBe(-10_000);
    expect(balanceDelta({ type: "REPAYMENT_RECEIVED", amountMinor: 10_000 })).toBe(10_000);
    expect(
      balanceDelta({ type: "TRANSFER", amountMinor: 10_000, transferLeg: "from" }),
    ).toBe(-10_000);
    expect(
      balanceDelta({ type: "TRANSFER", amountMinor: 10_000, transferLeg: "to" }),
    ).toBe(10_000);
  });

  it("debt movements never count as income or expense", () => {
    for (const t of ["DEBT_BORROWED", "DEBT_LENT", "REPAYMENT_PAID", "REPAYMENT_RECEIVED"] as const) {
      expect(countsAsIncomeOrExpense(t)).toBe(false);
    }
  });
});

describe("budgets", () => {
  it("utilization states: ok / amber at 80% / red above 100%", () => {
    expect(budgetUtilization(500_000, 1_000_000).state).toBe("ok");
    expect(budgetUtilization(800_000, 1_000_000).state).toBe("warning");
    expect(budgetUtilization(1_000_001, 1_000_000).state).toBe("exceeded");
    expect(budgetUtilization(400_000, 1_000_000)).toMatchObject({
      percent: 40,
      remainingMinor: 600_000,
    });
    expect(budgetUtilization(100, 0).state).toBe("exceeded");
  });
});

describe("debts and receivables", () => {
  it("remaining balance subtracts only matching repayments", () => {
    const debt = { id: "d1", direction: "borrowed", principalMinor: 2_000_000 };
    const repayments = [
      { type: "REPAYMENT_PAID", amountMinor: 500_000, debtId: "d1", deletedAt: null },
      { type: "REPAYMENT_RECEIVED", amountMinor: 500_000, debtId: "d1", deletedAt: null }, // wrong direction
      { type: "REPAYMENT_PAID", amountMinor: 300_000, debtId: "other", deletedAt: null }, // other debt
      { type: "REPAYMENT_PAID", amountMinor: 200_000, debtId: "d1", deletedAt: new Date() }, // deleted
    ];
    expect(debtRemainingMinor(debt, repayments)).toBe(1_500_000);
  });

  it("lent debts settle with REPAYMENT_RECEIVED and never go negative", () => {
    const debt = { id: "d2", direction: "lent", principalMinor: 700_000 };
    const repayments = [
      { type: "REPAYMENT_RECEIVED", amountMinor: 900_000, debtId: "d2", deletedAt: null },
    ];
    expect(debtRemainingMinor(debt, repayments)).toBe(0);
    expect(isDebtSettled(debt, repayments)).toBe(true);
  });
});
