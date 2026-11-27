// Accounts module: CRUD + archive. Repositories, services and HTTP are
// layered in this file (repo → service → routes) to keep each module
// small; only this module's service touches its tables. Every query
// filters by userId (brief §3.3 user isolation).
import { Hono } from "hono";
import { and, asc, eq, isNull } from "drizzle-orm";
import { accountInputSchema } from "../../../shared/schemas";
import type { AppBindings } from "../../env";
import { withSession } from "../../middleware/session";
import { accounts } from "../../db/schema";
import type { WorkerDb } from "../../db/balance";

/* ─────────── repo ─────────── */

async function listAccounts(db: WorkerDb, userId: string, includeArchived: boolean) {
  const where = includeArchived
    ? and(eq(accounts.userId, userId), isNull(accounts.deletedAt))
    : and(eq(accounts.userId, userId), isNull(accounts.deletedAt), isNull(accounts.archivedAt));
  return db.select().from(accounts).where(where).orderBy(asc(accounts.createdAt));
}

async function getAccount(db: WorkerDb, userId: string, id: string) {
  const rows = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId), isNull(accounts.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

/* ─────────── service ─────────── */

export async function createAccount(db: WorkerDb, userId: string, input: unknown) {
  const parsed = accountInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: { status: 400 as const, message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است." } };
  }
  const now = new Date();
  const row = {
    id: crypto.randomUUID(),
    userId,
    name: parsed.data.name,
    type: parsed.data.type,
    bankCode: parsed.data.bankCode ?? null,
    cardLast4: parsed.data.cardLast4 || null,
    openingBalanceMinor: parsed.data.openingBalanceMinor,
    currency: "IRR",
    balanceMinor: parsed.data.openingBalanceMinor,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.insert(accounts).values(row);
  return { account: row };
}

export async function updateAccount(db: WorkerDb, userId: string, id: string, input: unknown) {
  const parsed = accountInputSchema.partial().safeParse(input);
  if (!parsed.success) {
    return { error: { status: 400 as const, message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است." } };
  }
  const existing = await getAccount(db, userId, id);
  if (!existing) return { error: { status: 404 as const, message: "حساب پیدا نشد." } };
  const patch = parsed.data;
  if (Object.keys(patch).length === 0) return { account: existing };
  await db
    .update(accounts)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.bankCode !== undefined ? { bankCode: patch.bankCode ?? null } : {}),
      ...(patch.cardLast4 !== undefined ? { cardLast4: patch.cardLast4 || null } : {}),
      ...(patch.openingBalanceMinor !== undefined
        ? {
            openingBalanceMinor: patch.openingBalanceMinor,
            balanceMinor: patch.openingBalanceMinor + (existing.balanceMinor - existing.openingBalanceMinor),
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  return { account: await getAccount(db, userId, id) };
}

export async function archiveAccount(db: WorkerDb, userId: string, id: string, archived: boolean) {
  const existing = await getAccount(db, userId, id);
  if (!existing) return { error: { status: 404 as const, message: "حساب پیدا نشد." } };
  await db
    .update(accounts)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  return { ok: true };
}

// Soft delete keeps history; the account disappears from lists.
export async function softDeleteAccount(db: WorkerDb, userId: string, id: string) {
  const existing = await getAccount(db, userId, id);
  if (!existing) return { error: { status: 404 as const, message: "حساب پیدا نشد." } };
  await db
    .update(accounts)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
  return { ok: true };
}

/* ─────────── routes ─────────── */

export function accountsModule() {
  const mod = new Hono<AppBindings>();

  mod.use("/api/accounts", withSession());
  mod.use("/api/accounts/*", withSession());

  mod.get("/api/accounts", async (c) => {
    const includeArchived = c.req.query("includeArchived") === "1";
    const rows = await listAccounts(c.get("orm"), c.get("userId"), includeArchived);
    return c.json({ accounts: rows });
  });

  mod.get("/api/accounts/:id", async (c) => {
    const row = await getAccount(c.get("orm"), c.get("userId"), c.req.param("id"));
    if (!row) return c.json({ error: { code: "not_found", message: "حساب پیدا نشد." } }, 404);
    return c.json({ account: row });
  });

  mod.post("/api/accounts", async (c) => {
    const result = await createAccount(c.get("orm"), c.get("userId"), await c.req.json().catch(() => null));
    if ("error" in result && result.error) {
      return c.json({ error: { code: "invalid_input", message: result.error.message } }, result.error.status);
    }
    return c.json({ account: result.account }, 201);
  });

  mod.patch("/api/accounts/:id", async (c) => {
    const result = await updateAccount(
      c.get("orm"),
      c.get("userId"),
      c.req.param("id"),
      await c.req.json().catch(() => null),
    );
    if ("error" in result && result.error) {
      return c.json({ error: { code: "invalid_input", message: result.error.message } }, result.error.status);
    }
    return c.json({ account: result.account });
  });

  mod.post("/api/accounts/:id/archive", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { archived?: boolean } | null;
    const result = await archiveAccount(c.get("orm"), c.get("userId"), c.req.param("id"), body?.archived ?? true);
    if ("error" in result && result.error) {
      return c.json({ error: { code: "not_found", message: result.error.message } }, result.error.status);
    }
    return c.json(result);
  });

  mod.delete("/api/accounts/:id", async (c) => {
    const result = await softDeleteAccount(c.get("orm"), c.get("userId"), c.req.param("id"));
    if ("error" in result && result.error) {
      return c.json({ error: { code: "not_found", message: result.error.message } }, result.error.status);
    }
    return c.json(result);
  });

  return mod;
}
