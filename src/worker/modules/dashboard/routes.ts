// Dashboard summary: real counts from the signed-in user's data so the
// UI can show true empty states — no hardcoded numbers (brief §1.4).
import { Hono } from "hono";
import { and, count, eq, isNull } from "drizzle-orm";
import type { AppBindings } from "../../env";
import { withSession } from "../../middleware/session";
import { accounts, budgets, debts, transactions } from "../../db/schema";
import { computeAccountBalance } from "../../../shared/domain/finance";

export function dashboardModule() {
  const mod = new Hono<AppBindings>();

  mod.get("/api/dashboard", withSession(), async (c) => {
    const orm = c.get("orm");
    const userId = c.get("userId");

    const [accountRows, txCount, budgetCount, debtCount] = await Promise.all([
      orm
        .select({
          id: accounts.id,
          opening: accounts.openingBalanceMinor,
          balance: accounts.balanceMinor,
        })
        .from(accounts)
        .where(
          and(eq(accounts.userId, userId), isNull(accounts.deletedAt), isNull(accounts.archivedAt)),
        ),
      orm
        .select({ n: count() })
        .from(transactions)
        .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt))),
      orm
        .select({ n: count() })
        .from(budgets)
        .where(and(eq(budgets.userId, userId), isNull(budgets.deletedAt))),
      orm
        .select({ n: count() })
        .from(debts)
        .where(and(eq(debts.userId, userId), isNull(debts.deletedAt))),
    ]);

    // Total balance: computed invariant (opening + signed sum) over each
    // account's non-deleted rows — the single shared function.
    const signed = await orm
      .select({
        accountId: transactions.accountId,
        type: transactions.type,
        amountMinor: transactions.amountMinor,
        transferLeg: transactions.transferLeg,
        deletedAt: transactions.deletedAt,
      })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), isNull(transactions.deletedAt)));

    let totalBalance = 0;
    for (const account of accountRows) {
      const rows = signed.filter((t) => t.accountId === account.id);
      totalBalance += computeAccountBalance(account.opening, rows);
    }

    return c.json({
      counts: {
        accounts: accountRows.length,
        transactions: Number(txCount[0]?.n ?? 0),
        budgets: Number(budgetCount[0]?.n ?? 0),
        debts: Number(debtCount[0]?.n ?? 0),
      },
      totalBalanceMinor: totalBalance,
    });
  });

  return mod;
}
