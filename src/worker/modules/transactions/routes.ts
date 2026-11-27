// Transactions module (brief §3.3): 7 types; income/expense single-leg;
// transfers expand to two rows sharing a transfer id; every write pairs
// with balance-refresh statements in ONE db.batch(); soft delete keeps
// history. Every query filters by userId.
import { Hono } from "hono";
import { and, asc, count, desc, eq, gte, isNull, like, lte } from "drizzle-orm";
import { transactionFilterSchema, transactionInputSchema, transactionPatchSchema } from "../../../shared/schemas";
import { dayKeyOf, jalaliKeyToUtcEnd, jalaliKeyToUtcStart, monthKeyOf } from "../../../shared/domain/jalali";
import { checkAmountMinor } from "../../../shared/domain/money";
import type { AppBindings } from "../../env";
import { withSession } from "../../middleware/session";
import { accounts, transactions } from "../../db/schema";
import { balanceRefresh, type WorkerDb } from "../../db/balance";

/* ─────────── repo ─────────── */

async function accountExists(db: WorkerDb, userId: string, id: string): Promise<boolean> {
  const rows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId), isNull(accounts.deletedAt)))
    .limit(1);
  return rows.length > 0;
}

/* ─────────── service ─────────── */

type TxInput = ReturnType<typeof transactionInputSchema.parse>;
type TxError = { ok: false; error: { status: 400 | 404; message: string } };
type InputResult = TxError | { ok: true; data: TxInput };

function parseTransactionInput(input: unknown): InputResult {
  const parsed = transactionInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: { status: 400 as const, message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است." } };
  }
  const amountError = checkAmountMinor(parsed.data.amountMinor);
  if (amountError) return { ok: false, error: { status: 400 as const, message: amountError } };
  return { ok: true, data: parsed.data };
}

/** Create a transaction: single-leg types, or a two-leg transfer in one atomic batch. */
export async function createTransaction(
  db: WorkerDb,
  userId: string,
  input: unknown,
): Promise<TxError | { ok: true; transferId?: string }> {
  const parsed = parseTransactionInput(input);
  if (!parsed.ok) return parsed;
  const data = parsed.data;
  const now = new Date();
  const occurredAt = data.dayKey ? jalaliKeyToUtcStart(data.dayKey) : now;
  const dayKey = data.dayKey;
  const monthKey = monthKeyOf(occurredAt);

  const fromOk = await accountExists(db, userId, data.accountId);
  if (!fromOk) return { ok: false as const, error: { status: 404 as const, message: "حساب پیدا نشد." } };

  if (data.type === "TRANSFER") {
    const toOk = await accountExists(db, userId, data.toAccountId!);
    if (!toOk) return { ok: false as const, error: { status: 404 as const, message: "حساب مقصد پیدا نشد." } };
    const transferId = crypto.randomUUID();
    const base = {
      userId,
      amountMinor: data.amountMinor,
      currency: "IRR",
      dayKey,
      monthKey,
      occurredAt,
      categoryId: null,
      personId: null,
      paymentMethod: data.paymentMethod ?? null,
      note: data.note ?? null,
      transferId,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    // One atomic batch: two legs + both balance refreshes.
    await db.batch([
      db.insert(transactions).values({
        ...base,
        id: crypto.randomUUID(),
        accountId: data.accountId,
        type: "TRANSFER",
        transferLeg: "from",
        relatedAccountId: data.toAccountId!,
      }),
      db.insert(transactions).values({
        ...base,
        id: crypto.randomUUID(),
        accountId: data.toAccountId!,
        type: "TRANSFER",
        transferLeg: "to",
        relatedAccountId: data.accountId,
      }),
      balanceRefresh(db, data.accountId),
      balanceRefresh(db, data.toAccountId!),
    ]);
    return { ok: true, transferId };
  }

  await db.batch([
    db.insert(transactions).values({
      id: crypto.randomUUID(),
      userId,
      accountId: data.accountId,
      type: data.type,
      amountMinor: data.amountMinor,
      currency: "IRR",
      dayKey,
      monthKey,
      occurredAt,
      categoryId: data.categoryId ?? null,
      personId: data.personId ?? null,
      paymentMethod: data.paymentMethod ?? null,
      note: data.note ?? null,
      transferId: null,
      transferLeg: null,
      relatedAccountId: null,
      debtId: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    }),
    balanceRefresh(db, data.accountId),
  ]);
  return { ok: true };
}

/** Edit a transaction: amount/account/category/note/day. Transfers edit both legs atomically. */
export async function updateTransaction(
  db: WorkerDb,
  userId: string,
  id: string,
  input: unknown,
): Promise<TxError | { ok: true }> {
  const partial = transactionPatchSchema.safeParse(input);
  if (!partial.success) {
    return { ok: false as const, error: { status: 400 as const, message: partial.error.issues[0]?.message ?? "ورودی نامعتبر است." } };
  }
  const patch = partial.data;

  const rows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId), isNull(transactions.deletedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) return { ok: false as const, error: { status: 404 as const, message: "تراکنش پیدا نشد." } };

  if (patch.amountMinor !== undefined) {
    const amountError = checkAmountMinor(patch.amountMinor);
    if (amountError) return { ok: false as const, error: { status: 400 as const, message: amountError } };
  }

  const dayKey = patch.dayKey ?? row.dayKey;
  const occurredAt = patch.dayKey ? jalaliKeyToUtcStart(patch.dayKey) : row.occurredAt;

  if (row.type === "TRANSFER") {
    if (patch.type && patch.type !== "TRANSFER") {
      return { ok: false as const, error: { status: 400 as const, message: "نوع انتقال قابل تغییر نیست؛ آن را حذف و دوباره ثبت کنید." } };
    }
    const toRows = row.transferId
      ? await db
          .select()
          .from(transactions)
          .where(and(eq(transactions.transferId, row.transferId), eq(transactions.transferLeg, "to"), isNull(transactions.deletedAt)))
          .limit(1)
      : [];
    const toLeg = toRows[0];
    if (!toLeg) return { ok: false as const, error: { status: 404 as const, message: "پایهٔ مقصد انتقال پیدا نشد." } };
    const newAmount = patch.amountMinor ?? row.amountMinor;
    const newFrom = patch.accountId ?? row.accountId;
    const newTo = patch.toAccountId ?? toLeg.accountId;
    if (!(await accountExists(db, userId, newFrom)) || !(await accountExists(db, userId, newTo))) {
      return { ok: false as const, error: { status: 404 as const, message: "حساب پیدا نشد." } };
    }
    if (newFrom === newTo) {
      return { ok: false as const, error: { status: 400 as const, message: "مبدأ و مقصد نمی‌توانند یکی باشند." } };
    }
    await db.batch([
      db
        .update(transactions)
        .set({
          accountId: newFrom,
          amountMinor: newAmount,
          relatedAccountId: newTo,
          note: patch.note ?? row.note,
          dayKey,
          monthKey: monthKeyOf(occurredAt),
          occurredAt,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, row.id)),
      db
        .update(transactions)
        .set({
          accountId: newTo,
          amountMinor: newAmount,
          relatedAccountId: newFrom,
          note: patch.note ?? toLeg.note,
          dayKey,
          monthKey: monthKeyOf(occurredAt),
          occurredAt,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, toLeg.id)),
      balanceRefresh(db, row.accountId),
      balanceRefresh(db, toLeg.accountId),
      balanceRefresh(db, newFrom),
      balanceRefresh(db, newTo),
    ]);
    return { ok: true };
  }

  if (patch.toAccountId) {
    return { ok: false as const, error: { status: 400 as const, message: "حساب مقصد فقط برای انتقال است." } };
  }
  const newAccount = patch.accountId ?? row.accountId;
  if (!(await accountExists(db, userId, newAccount))) {
    return { ok: false as const, error: { status: 404 as const, message: "حساب پیدا نشد." } };
  }
  await db.batch([
    db
      .update(transactions)
      .set({
        accountId: newAccount,
        type: patch.type ?? row.type,
        amountMinor: patch.amountMinor ?? row.amountMinor,
        categoryId: patch.categoryId !== undefined ? (patch.categoryId ?? null) : row.categoryId,
        personId: patch.personId !== undefined ? (patch.personId ?? null) : row.personId,
        paymentMethod: patch.paymentMethod !== undefined ? (patch.paymentMethod ?? null) : row.paymentMethod,
        note: patch.note !== undefined ? (patch.note ?? null) : row.note,
        dayKey,
        monthKey: monthKeyOf(occurredAt),
        occurredAt,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, row.id)),
    balanceRefresh(db, row.accountId),
    balanceRefresh(db, newAccount),
  ]);
  return { ok: true };
}

/** Soft delete: transfers delete both legs + refresh both balances in one batch. */
export async function deleteTransaction(db: WorkerDb, userId: string, id: string): Promise<TxError | { ok: true }> {
  const rows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId), isNull(transactions.deletedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) return { ok: false as const, error: { status: 404 as const, message: "تراکنش پیدا نشد." } };
  const now = new Date();

  if (row.type === "TRANSFER" && row.transferId) {
    const legs = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.transferId, row.transferId), isNull(transactions.deletedAt)));
    const accountIds = [...new Set(legs.map((l) => l.accountId))];
    await db.batch([
      db.update(transactions).set({ deletedAt: now, updatedAt: now }).where(eq(transactions.transferId, row.transferId)),
      ...accountIds.map((accountId) => balanceRefresh(db, accountId)),
    ]);
    return { ok: true };
  }

  await db.batch([
    db.update(transactions).set({ deletedAt: now, updatedAt: now }).where(eq(transactions.id, row.id)),
    balanceRefresh(db, row.accountId),
  ]);
  return { ok: true };
}

/* ─────────── routes ─────────── */

export function transactionsModule() {
  const mod = new Hono<AppBindings>();

  mod.use("/api/transactions", withSession());
  mod.use("/api/transactions/*", withSession());

  mod.get("/api/transactions", async (c) => {
    const parsed = transactionFilterSchema.safeParse(c.req.query());
    if (!parsed.success) {
      return c.json({ error: { code: "invalid_input", message: "فیلترها نامعتبر است." } }, 400);
    }
    const f = parsed.data;
    const orm = c.get("orm");
    const userId = c.get("userId");
    const conditions = [eq(transactions.userId, userId), isNull(transactions.deletedAt)];
    if (f.type) conditions.push(eq(transactions.type, f.type));
    if (f.accountId) conditions.push(eq(transactions.accountId, f.accountId));
    if (f.categoryId) conditions.push(eq(transactions.categoryId, f.categoryId));
    if (f.q) conditions.push(like(transactions.note, `%${f.q}%`));
    if (f.fromDay) conditions.push(gte(transactions.occurredAt, jalaliKeyToUtcStart(f.fromDay)));
    if (f.toDay) conditions.push(lte(transactions.occurredAt, jalaliKeyToUtcEnd(f.toDay)));

    const where = and(...conditions);
    const countRows = await orm
      .select({ n: count() })
      .from(transactions)
      .where(where);
    const total = Number(countRows[0]?.n ?? 0);

    const rows = await orm
      .select()
      .from(transactions)
      .where(where)
      .orderBy(desc(transactions.occurredAt), asc(transactions.id))
      .limit(f.pageSize)
      .offset((f.page - 1) * f.pageSize);

    return c.json({ transactions: rows, page: f.page, pageSize: f.pageSize, total });
  });

  mod.get("/api/transactions/:id", async (c) => {
    const rows = await c.get("orm")
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.id, c.req.param("id")),
          eq(transactions.userId, c.get("userId")),
          isNull(transactions.deletedAt),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return c.json({ error: { code: "not_found", message: "تراکنش پیدا نشد." } }, 404);
    // For transfers expose the counterparty leg id so the edit form can show both sides.
    let toAccountId: string | null = null;
    if (row.type === "TRANSFER" && row.transferId) {
      const other = await c.get("orm")
        .select({ accountId: transactions.accountId })
        .from(transactions)
        .where(and(eq(transactions.transferId, row.transferId), eq(transactions.transferLeg, "to"), isNull(transactions.deletedAt)))
        .limit(1);
      toAccountId = other[0]?.accountId ?? null;
    }
    return c.json({ transaction: { ...row, toAccountId } });
  });

  mod.post("/api/transactions", async (c) => {
    const result = await createTransaction(c.get("orm"), c.get("userId"), await c.req.json().catch(() => null));
    if (!result.ok) {
      return c.json({ error: { code: "invalid_input", message: result.error.message } }, result.error.status);
    }
    return c.json({ ok: true, transferId: "transferId" in result ? result.transferId : undefined }, 201);
  });

  mod.patch("/api/transactions/:id", async (c) => {
    const result = await updateTransaction(
      c.get("orm"),
      c.get("userId"),
      c.req.param("id"),
      await c.req.json().catch(() => null),
    );
    if (!result.ok) {
      return c.json({ error: { code: "invalid_input", message: result.error.message } }, result.error.status);
    }
    return c.json({ ok: true });
  });

  mod.delete("/api/transactions/:id", async (c) => {
    const result = await deleteTransaction(c.get("orm"), c.get("userId"), c.req.param("id"));
    if (!result.ok) {
      return c.json({ error: { code: "not_found", message: result.error.message } }, result.error.status);
    }
    return c.json({ ok: true });
  });

  // Account detail page: rows of one account (already user-filtered).
  mod.get("/api/accounts/:id/transactions", async (c) => {
    const orm = c.get("orm");
    const userId = c.get("userId");
    const accountId = c.req.param("id");
    const owned = await accountExists(orm, userId, accountId);
    if (!owned) return c.json({ error: { code: "not_found", message: "حساب پیدا نشد." } }, 404);
    const rows = await orm
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.accountId, accountId), isNull(transactions.deletedAt)))
      .orderBy(desc(transactions.occurredAt))
      .limit(200);
    return c.json({ transactions: rows });
  });

  return mod;
}

// Exported for reports (Stage 4) — signed day key of "now" in Tehran.
export function todayDayKey(now: Date = new Date()): string {
  return dayKeyOf(now);
}
