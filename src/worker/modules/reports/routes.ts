// Reports on real data (brief §6 Phase 1): income vs expenses, category
// breakdown, cash flow per Jalali day, account balances — with a custom
// Jalali range and previous-period comparison. Only INCOME/EXPENSE feed
// the totals (shared rule).
import { Hono } from "hono";
import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { z } from "zod";
import type { AppBindings } from "../../env";
import { withSession } from "../../middleware/session";
import { accounts, categories, transactions } from "../../db/schema";
import { countsAsIncomeOrExpense } from "../../../shared/domain/finance";
import { jalaliKeyToUtcEnd, jalaliKeyToUtcStart } from "../../../shared/domain/jalali";

const rangeSchema = z.object({
  fromDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  toDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export function reportsModule() {
  const mod = new Hono<AppBindings>();

  mod.use("/api/reports", withSession());
  mod.use("/api/reports/*", withSession());

  mod.get("/api/reports/summary", async (c) => {
    const parsed = rangeSchema.safeParse(c.req.query());
    if (!parsed.success) {
      return c.json({ error: { code: "invalid_input", message: "بازهٔ تاریخ نامعتبر است." } }, 400);
    }
    const orm = c.get("orm");
    const userId = c.get("userId");
    const { fromDay, toDay } = parsed.data;

    // Previous period of equal length, immediately before this one.
    const lengthDays = Math.max(
      1,
      Math.round(
        (jalaliKeyToUtcEnd(toDay).getTime() - jalaliKeyToUtcStart(fromDay).getTime()) / (24 * 60 * 60_000),
      ) + 1,
    );
    const prevToInstant = jalaliKeyToUtcStart(fromDay).getTime() - 24 * 60 * 60_000;
    const prevFromInstant = prevToInstant - (lengthDays - 1) * 24 * 60 * 60_000;

    const rows = await orm
      .select({
        type: transactions.type,
        amountMinor: transactions.amountMinor,
        dayKey: transactions.dayKey,
        categoryId: transactions.categoryId,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          isNull(transactions.deletedAt),
          gte(transactions.occurredAt, jalaliKeyToUtcStart(fromDay)),
          lte(transactions.occurredAt, jalaliKeyToUtcEnd(toDay)),
        ),
      );

    let income = 0;
    let expense = 0;
    const byCategory = new Map<string, number>();
    const byDay = new Map<string, { income: number; expense: number }>();
    for (const r of rows) {
      if (!countsAsIncomeOrExpense(r.type as never)) continue;
      if (r.type === "INCOME") {
        income += r.amountMinor;
        const d = byDay.get(r.dayKey) ?? { income: 0, expense: 0 };
        d.income += r.amountMinor;
        byDay.set(r.dayKey, d);
      } else {
        expense += r.amountMinor;
        if (r.categoryId) {
          byCategory.set(r.categoryId, (byCategory.get(r.categoryId) ?? 0) + r.amountMinor);
        }
        const d = byDay.get(r.dayKey) ?? { income: 0, expense: 0 };
        d.expense += r.amountMinor;
        byDay.set(r.dayKey, d);
      }
    }

    const prevRows = await orm
      .select({ type: transactions.type, amountMinor: transactions.amountMinor })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          isNull(transactions.deletedAt),
          gte(transactions.occurredAt, new Date(prevFromInstant)),
          lte(transactions.occurredAt, new Date(prevToInstant + 24 * 60 * 60_000 - 1)),
        ),
      );
    let prevIncome = 0;
    let prevExpense = 0;
    for (const r of prevRows) {
      if (!countsAsIncomeOrExpense(r.type as never)) continue;
      if (r.type === "INCOME") prevIncome += r.amountMinor;
      else prevExpense += r.amountMinor;
    }

    const accountRows = await orm
      .select({ id: accounts.id, name: accounts.name, balanceMinor: accounts.balanceMinor, type: accounts.type })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt), isNull(accounts.archivedAt)));

    const catRows = await orm
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.userId, userId));
    const catNames = new Map(catRows.map((x) => [x.id, x.name]));

    return c.json({
      range: { fromDay, toDay },
      totals: { incomeMinor: income, expenseMinor: expense, netMinor: income - expense },
      previous: {
        incomeMinor: prevIncome,
        expenseMinor: prevExpense,
      },
      byCategory: [...byCategory.entries()]
        .map(([id, amountMinor]) => ({ categoryId: id, name: catNames.get(id) ?? "—", amountMinor }))
        .sort((a, b) => b.amountMinor - a.amountMinor),
      cashFlow: [...byDay.entries()]
        .map(([dayKey, v]) => ({ dayKey, ...v }))
        .sort((a, b) => a.dayKey.localeCompare(b.dayKey)),
      accounts: accountRows,
      transactionCount: rows.length,
    });
  });

  return mod;
}
