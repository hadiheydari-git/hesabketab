// Debts & receivables (بدهی و طلب): بدهی من (borrowed) / طلب من (lent).
// Optional linked account: the principal movement and each repayment hit
// the account balance atomically in one batch, typed as DEBT_*/REPAYMENT_*
// so income/expense totals stay untouched. Remaining balance and overdue
// state come from the shared pure functions.
import { Hono } from "hono";
import { and, desc, eq, isNull } from "drizzle-orm";
import { debtInputSchema, repaymentInputSchema } from "../../../shared/schemas";
import { debtRemainingMinor } from "../../../shared/domain/finance";
import { dayKeyOf, isOverdue, jalaliKeyToUtcStart, monthKeyOf } from "../../../shared/domain/jalali";
import type { AppBindings, WorkerDb } from "../../env";
import { withSession } from "../../middleware/session";
import { accounts, debts, people, transactions } from "../../db/schema";
import { balanceRefresh } from "../../db/balance";


async function getDebt(db: WorkerDb, userId: string, id: string) {
  const rows = await db
    .select()
    .from(debts)
    .where(and(eq(debts.id, id), eq(debts.userId, userId), isNull(debts.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

async function repaymentsOf(db: WorkerDb, userId: string, debtId: string) {
  return db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.debtId, debtId), isNull(transactions.deletedAt)))
    .orderBy(desc(transactions.occurredAt));
}

function decorate(
  debt: typeof debts.$inferSelect,
  repayments: (typeof transactions.$inferSelect)[],
  now: Date,
) {
  const remainingMinor = debtRemainingMinor(debt, repayments);
  return {
    ...debt,
    remainingMinor,
    settled: remainingMinor === 0,
    overdue: Boolean(debt.dueDayKey && remainingMinor > 0 && isOverdue(debt.dueDayKey, now)),
  };
}

/** Verify the row belongs to this user (accounts and people). */
async function ownedRow(
  db: WorkerDb,
  userId: string,
  table: typeof accounts | typeof people,
  id: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, id), eq(table.userId, userId), isNull(table.deletedAt)))
    .limit(1);
  return rows.length > 0;
}

export function debtsModule() {
  const mod = new Hono<AppBindings>();

  mod.use("/api/debts", withSession());
  mod.use("/api/debts/*", withSession());

  mod.get("/api/debts", async (c) => {
    const orm = c.get("orm");
    const userId = c.get("userId");
    const rows = await orm
      .select()
      .from(debts)
      .where(and(eq(debts.userId, userId), isNull(debts.deletedAt)))
      .orderBy(desc(debts.createdAt));
    const now = new Date();
    const all = await Promise.all(
      rows.map(async (d) => decorate(d, await repaymentsOf(orm, userId, d.id), now)),
    );
    return c.json({ debts: all });
  });

  mod.get("/api/debts/:id", async (c) => {
    const orm = c.get("orm");
    const userId = c.get("userId");
    const debt = await getDebt(orm, userId, c.req.param("id"));
    if (!debt) return c.json({ error: { code: "not_found", message: "بدهی پیدا نشد." } }, 404);
    return c.json({
      debt: decorate(debt, await repaymentsOf(orm, userId, debt.id), new Date()),
      repayments: await repaymentsOf(orm, userId, debt.id),
    });
  });

  // Create a debt. With a linked account, the principal movement
  // (DEBT_BORROWED / DEBT_LENT) is written in the same batch.
  mod.post("/api/debts", async (c) => {
    const parsed = debtInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        { error: { code: "invalid_input", message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است." } },
        400,
      );
    }
    const orm = c.get("orm");
    const userId = c.get("userId");
    const data = parsed.data;

    if (!(await ownedRow(orm, userId, people, data.personId))) {
      return c.json({ error: { code: "not_found", message: "طرف‌حساب پیدا نشد." } }, 404);
    }
    if (data.accountId && !(await ownedRow(orm, userId, accounts, data.accountId))) {
      return c.json({ error: { code: "not_found", message: "حساب پیدا نشد." } }, 404);
    }

    const now = new Date();
    const debtRow = {
      id: crypto.randomUUID(),
      userId,
      personId: data.personId,
      direction: data.direction,
      principalMinor: data.principalMinor,
      currency: "IRR",
      accountId: data.accountId ?? null,
      dueDayKey: data.dueDayKey ?? null,
      installments: data.installments ?? null,
      note: data.note ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    if (debtRow.accountId) {
      const movementDay = dayKeyOf(now);
      const occurredAt = jalaliKeyToUtcStart(movementDay);
      await orm.batch([
        orm.insert(debts).values(debtRow),
        orm.insert(transactions).values({
          id: crypto.randomUUID(),
          userId,
          accountId: debtRow.accountId,
          type: data.direction === "borrowed" ? "DEBT_BORROWED" : "DEBT_LENT",
          amountMinor: data.principalMinor,
          currency: "IRR",
          dayKey: movementDay,
          monthKey: monthKeyOf(occurredAt),
          occurredAt,
          categoryId: null,
          personId: data.personId,
          paymentMethod: null,
          note: data.note ?? null,
          transferId: null,
          transferLeg: null,
          relatedAccountId: null,
          debtId: debtRow.id,
          deletedAt: null,
          createdAt: now,
          updatedAt: now,
        }),
        balanceRefresh(orm, debtRow.accountId),
      ]);
    } else {
      await orm.insert(debts).values(debtRow);
    }
    return c.json({ debt: debtRow }, 201);
  });

  // Record a repayment. With a linked account it also moves the money in
  // one atomic batch; the type follows the debt direction so the balance
  // math stays correct and income/expense never inflate.
  mod.post("/api/debts/:id/repayments", async (c) => {
    const parsed = repaymentInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        { error: { code: "invalid_input", message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است." } },
        400,
      );
    }
    const orm = c.get("orm");
    const userId = c.get("userId");
    const debt = await getDebt(orm, userId, c.req.param("id"));
    if (!debt) return c.json({ error: { code: "not_found", message: "بدهی پیدا نشد." } }, 404);

    const reps = await repaymentsOf(orm, userId, debt.id);
    const remaining = debtRemainingMinor(debt, reps);
    if (remaining === 0) {
      return c.json({ error: { code: "invalid_input", message: "این بدهی تسویه شده است." } }, 400);
    }
    if (parsed.data.amountMinor > remaining) {
      return c.json(
        { error: { code: "invalid_input", message: "مبلغ بازپرداخت از ماندهٔ بدهی بیشتر است." } },
        400,
      );
    }
    const accountId = parsed.data.accountId ?? debt.accountId ?? null;
    if (!accountId) {
      return c.json(
        { error: { code: "invalid_input", message: "برای ثبت بازپرداخت، حساب را انتخاب کنید." } },
        400,
      );
    }
    if (!(await ownedRow(orm, userId, accounts, accountId))) {
      return c.json({ error: { code: "not_found", message: "حساب پیدا نشد." } }, 404);
    }

    const now = new Date();
    const dayKey = parsed.data.dayKey;
    const occurredAt = jalaliKeyToUtcStart(dayKey);
    const txRow = {
      id: crypto.randomUUID(),
      userId,
      accountId: accountId!,
      type: debt.direction === "borrowed" ? "REPAYMENT_PAID" : "REPAYMENT_RECEIVED",
      amountMinor: parsed.data.amountMinor,
      currency: "IRR",
      dayKey,
      monthKey: monthKeyOf(occurredAt),
      occurredAt,
      categoryId: null,
      personId: debt.personId,
      paymentMethod: null,
      note: parsed.data.note ?? null,
      transferId: null,
      transferLeg: null,
      relatedAccountId: null,
      debtId: debt.id,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    // One atomic batch: repayment row + balance refresh.
    await orm.batch([orm.insert(transactions).values(txRow), balanceRefresh(orm, accountId!)]);
    return c.json({ ok: true }, 201);
  });

  // Soft delete a debt (history preserved).
  mod.delete("/api/debts/:id", async (c) => {
    const orm = c.get("orm");
    const userId = c.get("userId");
    const debt = await getDebt(orm, userId, c.req.param("id"));
    if (!debt) return c.json({ error: { code: "not_found", message: "بدهی پیدا نشد." } }, 404);
    await orm
      .update(debts)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(debts.id, debt.id));
    return c.json({ ok: true });
  });

  return mod;
}
