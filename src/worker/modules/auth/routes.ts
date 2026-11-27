// Auth-related HTTP modules: one-time recovery codes and password reset
// without email (brief §3.4). Only sha-256 hashes of codes are stored;
// a successful reset invalidates the used code and every existing session.
import { Hono } from "hono";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { hashPassword } from "better-auth/crypto";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../../db/schema";
import type { AppBindings, WorkerDb } from "../../env";
import { withSession } from "../../middleware/session";
import {
  RECOVERY_CODE_COUNT,
  generateRecoveryCodes,
  normalizeRecoveryCode,
} from "../../../shared/domain/recovery-codes";

const FORGOT_MAX_ATTEMPTS_PER_HOUR = 10;

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Generate fresh codes, store only their hashes (replacing all previous codes) and return the plaintext codes once. */
export async function regenerateRecoveryCodes(db: WorkerDb, userId: string): Promise<string[]> {
  const codes = await generateRecoveryCodes(async (n) => randomBytes(n), RECOVERY_CODE_COUNT);
  const now = new Date();
  const values = await Promise.all(
    codes.map(async (code) => ({
      id: crypto.randomUUID(),
      userId,
      codeHash: await sha256Hex(code),
      createdAt: now,
      usedAt: null as Date | null,
    })),
  );
  // Single batch for the multi-row write (brief §3.3).
  await db.batch([
    db.delete(schema.recoveryCodes).where(eq(schema.recoveryCodes.userId, userId)),
    db.insert(schema.recoveryCodes).values(values),
  ]);
  return codes;
}

const forgotSchema = z.object({
  username: z.string().min(3).max(32),
  code: z.string().min(8).max(16),
  newPassword: z.string().min(8).max(128),
});

export function authModule() {
  const mod = new Hono<AppBindings>();

  // Recovery-code routes require a session; /api/auth/forgot-password
  // below stays public on purpose.
  mod.use("/api/recovery-codes", withSession());
  mod.use("/api/recovery-codes/*", withSession());

  // How many unused codes the signed-in user has (codes are never returned again).
  mod.get("/api/recovery-codes/status", async (c) => {
    const orm = c.get("orm");
    const rows = await orm
      .select({ id: schema.recoveryCodes.id })
      .from(schema.recoveryCodes)
      .where(
        and(eq(schema.recoveryCodes.userId, c.get("userId")), isNull(schema.recoveryCodes.usedAt)),
      );
    return c.json({ unusedCount: rows.length });
  });

  // Regenerate: authenticated; returns the new codes exactly once.
  mod.post("/api/recovery-codes", async (c) => {
    const codes = await regenerateRecoveryCodes(c.get("orm"), c.get("userId"));
    return c.json({ codes });
  });

  // Password reset with username + one-time code + new password (no email).
  mod.post("/api/auth/forgot-password", async (c) => {
    const parsed = forgotSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json(
        { error: { code: "invalid_input", message: "اطلاعات واردشده کامل نیست." } },
        400,
      );
    }
    // Public route: build its own drizzle instance (no session middleware).
    const orm = drizzle(c.env.DB, { schema });
    const username = parsed.data.username.trim().toLowerCase();
    const code = normalizeRecoveryCode(parsed.data.code);

    // D1-backed rate limit per username (survives isolate restarts).
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const attempts = await orm
      .select({ id: schema.rateLimits.id })
      .from(schema.rateLimits)
      .where(
        and(
          eq(schema.rateLimits.key, `forgot:${username}`),
          gt(schema.rateLimits.createdAt, oneHourAgo),
        ),
      );
    if (attempts.length >= FORGOT_MAX_ATTEMPTS_PER_HOUR) {
      return c.json(
        { error: { code: "rate_limited", message: "تلاش‌های زیاد؛ کمی بعد دوباره امتحان کنید." } },
        429,
      );
    }
    await orm.insert(schema.rateLimits).values({
      id: crypto.randomUUID(),
      key: `forgot:${username}`,
      createdAt: new Date(),
    });

    // Generic error message: never reveal which part was wrong.
    const generic = () =>
      c.json(
        {
          error: {
            code: "invalid_credentials",
            message: "نام کاربری، کد بازیابی یا رمز جدید معتبر نیست.",
          },
        },
        401,
      );

    const users = await orm
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.username, username))
      .limit(1);
    const user = users[0];
    if (!user) return generic();

    const codes = await orm
      .select()
      .from(schema.recoveryCodes)
      .where(and(eq(schema.recoveryCodes.userId, user.id), isNull(schema.recoveryCodes.usedAt)));
    if (codes.length === 0) return generic();

    const codeHash = await sha256Hex(code);
    const matched = codes.find((row) => row.codeHash === codeHash);
    if (!matched) return generic();

    // Hash the new password with the same algorithm Better Auth uses.
    const passwordHash = await hashPassword(parsed.data.newPassword);
    const now = new Date();
    // Single atomic batch: consume code + set password + kill sessions.
    await orm.batch([
      orm
        .update(schema.recoveryCodes)
        .set({ usedAt: now })
        .where(eq(schema.recoveryCodes.id, matched.id)),
      orm
        .update(schema.account)
        .set({ password: passwordHash, updatedAt: now })
        .where(
          and(eq(schema.account.userId, user.id), eq(schema.account.providerId, "credential")),
        ),
      orm.delete(schema.session).where(eq(schema.session.userId, user.id)),
    ]);
    return c.json({ ok: true });
  });

  return mod;
}
