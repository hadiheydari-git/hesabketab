// Settings & data management: profile (name), preferences (display unit,
// theme), password change, recovery-code regeneration (auth module),
// personal data export, and full account deletion (brief §3.4/§6).
import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import type { AppBindings } from "../../env";
import { withSession } from "../../middleware/session";
import {
  account,
  accounts,
  budgets,
  categories,
  debts,
  people,
  settings,
  transactions,
  user,
} from "../../db/schema";

const prefsSchema = z.object({
  displayUnit: z.enum(["toman", "rial"]).optional(),
  theme: z.enum(["light", "dark"]).optional(),
});

const nameSchema = z.object({ name: z.string().trim().min(1, "نام الزامی است.").max(64) });

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "رمز فعلی را وارد کنید."),
  newPassword: z.string().min(8, "رمز تازه دست‌کم ۸ نویسه است."),
});

export function settingsModule() {
  const mod = new Hono<AppBindings>();

  mod.use("/api/me", withSession());
  mod.use("/api/me/*", withSession());

  // Preferences: display unit + theme.
  mod.patch("/api/me/settings", async (c) => {
    const parsed = prefsSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: { code: "invalid_input", message: "تنظیمات نامعتبر است." } }, 400);
    }
    const orm = c.get("orm");
    const userId = c.get("userId");
    const patch = parsed.data;
    const existing = await orm.select().from(settings).where(eq(settings.userId, userId)).limit(1);
    if (existing[0]) {
      await orm
        .update(settings)
        .set({
          ...(patch.displayUnit !== undefined ? { displayUnit: patch.displayUnit } : {}),
          ...(patch.theme !== undefined ? { theme: patch.theme } : {}),
          updatedAt: new Date(),
        })
        .where(eq(settings.userId, userId));
    } else {
      await orm.insert(settings).values({
        userId,
        displayUnit: patch.displayUnit ?? "toman",
        theme: patch.theme ?? "light",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return c.json({ ok: true });
  });

  // Profile: display name.
  mod.patch("/api/me", async (c) => {
    const parsed = nameSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        { error: { code: "invalid_input", message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است." } },
        400,
      );
    }
    await c.get("orm")
      .update(user)
      .set({ name: parsed.data.name, updatedAt: new Date() })
      .where(eq(user.id, c.get("userId")));
    return c.json({ ok: true });
  });

  // Password change: verify the current password with the same algorithm
  // Better Auth uses, then write the new hash into the credential account.
  mod.post("/api/me/password", async (c) => {
    const parsed = passwordSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        { error: { code: "invalid_input", message: parsed.error.issues[0]?.message ?? "ورودی نامعتبر است." } },
        400,
      );
    }
    const orm = c.get("orm");
    const userId = c.get("userId");
    const creds = await orm
      .select()
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
      .limit(1);
    const cred = creds[0];
    if (!cred?.password) {
      return c.json({ error: { code: "not_found", message: "حساب کاربری رمز ندارد." } }, 404);
    }
    const valid = await verifyPassword({ hash: cred.password, password: parsed.data.currentPassword });
    if (!valid) {
      return c.json({ error: { code: "invalid_credentials", message: "رمز فعلی درست نیست." } }, 401);
    }
    const newHash = await hashPassword(parsed.data.newPassword);
    await orm.update(account).set({ password: newHash, updatedAt: new Date() }).where(eq(account.id, cred.id));
    return c.json({ ok: true });
  });

  // Personal data export: everything the user owns, as JSON.
  mod.get("/api/me/export", async (c) => {
    const orm = c.get("orm");
    const userId = c.get("userId");
    const [accountRows, categoryRows, peopleRows, txRows, debtRows, budgetRows, settingsRows] =
      await Promise.all([
        orm.select().from(accounts).where(eq(accounts.userId, userId)),
        orm.select().from(categories).where(eq(categories.userId, userId)),
        orm.select().from(people).where(eq(people.userId, userId)),
        orm.select().from(transactions).where(eq(transactions.userId, userId)),
        orm.select().from(debts).where(eq(debts.userId, userId)),
        orm.select().from(budgets).where(eq(budgets.userId, userId)),
        orm.select().from(settings).where(eq(settings.userId, userId)),
      ]);
    const me = await orm
      .select({ username: user.username, name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    c.header("content-disposition", 'attachment; filename="dakholvakharj-export.json"');
    return c.json({
      exportedAt: new Date().toISOString(),
      app: "دخل‌وخرج",
      profile: me[0] ?? null,
      settings: settingsRows[0] ?? null,
      accounts: accountRows,
      categories: categoryRows,
      people: peopleRows,
      transactions: txRows,
      debts: debtRows,
      budgets: budgetRows,
    });
  });

  // Full account deletion: every owned row in one batch (auth tables
  // cascade on user delete), then clear the session cookie.
  mod.post("/api/me/delete", async (c) => {
    const orm = c.get("orm");
    const userId = c.get("userId");
    await orm.batch([
      orm.delete(transactions).where(eq(transactions.userId, userId)),
      orm.delete(debts).where(eq(debts.userId, userId)),
      orm.delete(budgets).where(eq(budgets.userId, userId)),
      orm.delete(categories).where(eq(categories.userId, userId)),
      orm.delete(people).where(eq(people.userId, userId)),
      orm.delete(accounts).where(eq(accounts.userId, userId)),
      orm.delete(settings).where(eq(settings.userId, userId)),
      orm.delete(user).where(eq(user.id, userId)),
    ]);
    c.header("set-cookie", "dakholvakharj.session_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax");
    return c.json({ ok: true });
  });

  return mod;
}
