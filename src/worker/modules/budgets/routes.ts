// Budgets: monthly (Jalali month key), one or many categories, actual vs
// planned with utilization states (ok / amber 80% / red >100%) computed
// by the shared pure function from real EXPENSE transactions.
import { Hono } from "hono";
import { and, eq, inArray, isNull, sum } from "drizzle-orm";
import { budgetInputSchema } from "../../../shared/schemas";
import { budgetUtilization } from "../../../shared/domain/finance";
import type { AppBindings, WorkerDb } from "../../env";
import { withSession } from "../../middleware/session";
import { budgetCategories, budgets, categories, transactions } from "../../db/schema";

/** Actual spend = EXPENSE sum in the budget's categories for the Jalali month. */
async function sumExpenses(
  orm: WorkerDb,
  userId: string,
  monthKey: string,
  categoryIds: string[],
): Promise<number> {
  // monthKey is derived from occurred_at on write, so filtering by it is
  // exact — no extra date-range bounds needed.
  const rows = await orm
    .select({ total: sum(transactions.amountMinor) })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        eq(transactions.type, "EXPENSE"),
        eq(transactions.monthKey, monthKey),
        inArray(transactions.categoryId, categoryIds),
      ),
    );
  return Number(rows[0]?.total ?? 0);
}

export function budgetsModule() {
  const mod = new Hono<AppBindings>();

  mod.use("/api/budgets", withSession());
  mod.use("/api/budgets/*", withSession());

  mod.get("/api/budgets", async (c) => {
    const orm = c.get("orm");
    const userId = c.get("userId");
    const rows = await orm
      .select()
      .from(budgets)
      .where(and(eq(budgets.userId, userId), isNull(budgets.deletedAt)))
      .orderBy(budgets.monthKey);
    const out = await Promise.all(
      rows.map(async (b) => {
        const cats = await orm
          .select({ categoryId: budgetCategories.categoryId, name: categories.name })
          .from(budgetCategories)
          .innerJoin(categories, eq(categories.id, budgetCategories.categoryId))
          .where(eq(budgetCategories.budgetId, b.id));
        const categoryIds = cats.map((x) => x.categoryId);
        const actualMinor = categoryIds.length > 0 ? await sumExpenses(orm, userId, b.monthKey, categoryIds) : 0;
        const u = budgetUtilization(actualMinor, b.limitMinor);
        return {
          ...b,
          categories: cats.map((x) => x.name),
          categoryIds,
          actualMinor,
          percent: u.percent,
          state: u.state,
          remainingMinor: u.remainingMinor,
        };
      }),
    );
    return c.json({ budgets: out });
  });

  mod.post("/api/budgets", async (c) => {
    const parsed = budgetInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        { error: { code: "invalid_input", message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است." } },
        400,
      );
    }
    const orm = c.get("orm");
    const userId = c.get("userId");
    const data = parsed.data;

    // All categories must belong to the user.
    const uniqueIds = [...new Set(data.categoryIds)];
    const owned = await orm
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.userId, userId), isNull(categories.deletedAt), inArray(categories.id, uniqueIds)));
    if (owned.length !== uniqueIds.length) {
      return c.json({ error: { code: "not_found", message: "دسته‌بندی نامعتبر است." } }, 404);
    }

    const now = new Date();
    const budgetRow = {
      id: crypto.randomUUID(),
      userId,
      monthKey: data.monthKey,
      limitMinor: data.limitMinor,
      currency: "IRR",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    // One batch: budget + category links.
    await orm.batch([
      orm.insert(budgets).values(budgetRow),
      orm.insert(budgetCategories).values(
        uniqueIds.map((categoryId) => ({
          id: crypto.randomUUID(),
          budgetId: budgetRow.id,
          categoryId,
        })),
      ),
    ]);
    return c.json({ budget: budgetRow }, 201);
  });

  mod.delete("/api/budgets/:id", async (c) => {
    const orm = c.get("orm");
    const userId = c.get("userId");
    const rows = await orm
      .select({ id: budgets.id })
      .from(budgets)
      .where(and(eq(budgets.id, c.req.param("id")), eq(budgets.userId, userId), isNull(budgets.deletedAt)))
      .limit(1);
    if (!rows[0]) return c.json({ error: { code: "not_found", message: "بودجه پیدا نشد." } }, 404);
    await orm
      .update(budgets)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(budgets.id, rows[0].id));
    return c.json({ ok: true });
  });

  return mod;
}
