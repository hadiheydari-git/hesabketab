// People (طرف‌حساب‌ها): optional on transactions, required on debts.
// Person page data (net balances) comes from the debts module.
import { Hono } from "hono";
import { and, asc, eq, isNull } from "drizzle-orm";
import { personInputSchema } from "../../../shared/schemas";
import type { AppBindings } from "../../env";
import { withSession } from "../../middleware/session";
import { people } from "../../db/schema";

export function peopleModule() {
  const mod = new Hono<AppBindings>();

  mod.use("/api/people", withSession());
  mod.use("/api/people/*", withSession());

  mod.get("/api/people", async (c) => {
    const rows = await c.get("orm")
      .select()
      .from(people)
      .where(and(eq(people.userId, c.get("userId")), isNull(people.deletedAt)))
      .orderBy(asc(people.name));
    return c.json({ people: rows });
  });

  mod.post("/api/people", async (c) => {
    const parsed = personInputSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        { error: { code: "invalid_input", message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است." } },
        400,
      );
    }
    const now = new Date();
    const row = {
      id: crypto.randomUUID(),
      userId: c.get("userId"),
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      note: parsed.data.note ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await c.get("orm").insert(people).values(row);
    return c.json({ person: row }, 201);
  });

  mod.patch("/api/people/:id", async (c) => {
    const parsed = personInputSchema.partial().safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        { error: { code: "invalid_input", message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است." } },
        400,
      );
    }
    const patch = parsed.data;
    const userId = c.get("userId");
    const rows = await c.get("orm")
      .select()
      .from(people)
      .where(and(eq(people.id, c.req.param("id")), eq(people.userId, userId), isNull(people.deletedAt)))
      .limit(1);
    const row = rows[0];
    if (!row) return c.json({ error: { code: "not_found", message: "طرف‌حساب پیدا نشد." } }, 404);
    await c.get("orm")
      .update(people)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone || null } : {}),
        ...(patch.note !== undefined ? { note: patch.note ?? null } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(people.id, row.id), eq(people.userId, userId)));
    return c.json({ ok: true });
  });

  mod.delete("/api/people/:id", async (c) => {
    const userId = c.get("userId");
    const rows = await c.get("orm")
      .select({ id: people.id })
      .from(people)
      .where(and(eq(people.id, c.req.param("id")), eq(people.userId, userId), isNull(people.deletedAt)))
      .limit(1);
    if (!rows[0]) return c.json({ error: { code: "not_found", message: "طرف‌حساب پیدا نشد." } }, 404);
    await c.get("orm")
      .update(people)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(people.id, rows[0].id));
    return c.json({ ok: true });
  });

  return mod;
}
