// Categories module: seeded Persian categories are copied per user at
// registration; users add, rename and archive. No hard delete — archived
// categories stay referenced by history.
import { Hono } from "hono";
import { and, asc, eq, isNull } from "drizzle-orm";
import { categoryInputSchema } from "../../../shared/schemas";
import type { AppBindings } from "../../env";
import { withSession } from "../../middleware/session";
import { categories } from "../../db/schema";

export function categoriesModule() {
  const mod = new Hono<AppBindings>();

  mod.use("/api/categories", withSession());
  mod.use("/api/categories/*", withSession());

  mod.get("/api/categories", async (c) => {
    const includeArchived = c.req.query("includeArchived") === "1";
    const conditions = [
      eq(categories.userId, c.get("userId")),
      isNull(categories.deletedAt),
      ...(includeArchived ? [] : [isNull(categories.archivedAt)]),
    ];
    const rows = await c.get("orm")
      .select()
      .from(categories)
      .where(and(...conditions))
      .orderBy(asc(categories.kind), asc(categories.createdAt));
    return c.json({ categories: rows });
  });

  mod.post("/api/categories", async (c) => {
    const parsed = categoryInputSchema.safeParse(await c.req.json().catch(() => null));
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
      kind: parsed.data.kind,
      name: parsed.data.name,
      icon: parsed.data.icon ?? null,
      color: parsed.data.color ?? null,
      isSeed: false,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await c.get("orm").insert(categories).values(row);
    return c.json({ category: row }, 201);
  });

  mod.patch("/api/categories/:id", async (c) => {
    const parsed = categoryInputSchema.partial().safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        { error: { code: "invalid_input", message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است." } },
        400,
      );
    }
    const patch = parsed.data;
    const rows = await c.get("orm")
      .select()
      .from(categories)
      .where(and(eq(categories.id, c.req.param("id")), eq(categories.userId, c.get("userId")), isNull(categories.deletedAt)))
      .limit(1);
    const row = rows[0];
    if (!row) return c.json({ error: { code: "not_found", message: "دسته‌بندی پیدا نشد." } }, 404);
    await c.get("orm")
      .update(categories)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.icon !== undefined ? { icon: patch.icon ?? null } : {}),
        ...(patch.color !== undefined ? { color: patch.color ?? null } : {}),
        ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(categories.id, row.id), eq(categories.userId, c.get("userId"))));
    return c.json({ ok: true });
  });

  mod.post("/api/categories/:id/archive", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { archived?: boolean } | null;
    const archived = body?.archived ?? true;
    const rows = await c.get("orm")
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, c.req.param("id")), eq(categories.userId, c.get("userId")), isNull(categories.deletedAt)))
      .limit(1);
    if (!rows[0]) return c.json({ error: { code: "not_found", message: "دسته‌بندی پیدا نشد." } }, 404);
    await c.get("orm")
      .update(categories)
      .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
      .where(eq(categories.id, rows[0].id));
    return c.json({ ok: true });
  });

  return mod;
}
