// Worker entry: /api/health (public), Better Auth handler (/api/auth/**),
// /api/me (session-gated), auth module (recovery codes + reset), JSON 404
// for unknown /api/* paths. All other paths are static SPA assets.
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { AppBindings } from "./env";
import { APP_TITLE } from "../shared/constants";
import { createAuth } from "./auth";
import { authModule } from "./modules/auth/routes";
import { dashboardModule } from "./modules/dashboard/routes";
import { accountsModule } from "./modules/accounts/routes";
import { transactionsModule } from "./modules/transactions/routes";
import { categoriesModule } from "./modules/categories/routes";
import { peopleModule } from "./modules/people/routes";
import { debtsModule } from "./modules/debts/routes";
import { budgetsModule } from "./modules/budgets/routes";
import { reportsModule } from "./modules/reports/routes";
import { settingsModule } from "./modules/settings/routes";
import { withSession } from "./middleware/session";
import { settings, user } from "./db/schema";

const app = new Hono<AppBindings>();

// Health is public and dependency-free.
app.get("/api/health", (c) =>
  c.json({ ok: true, name: APP_TITLE, time: new Date().toISOString() }),
);

// Auth module FIRST: its POST /api/auth/forgot-password must win over
// the Better Auth catch-all below (Hono matches in registration order).
app.route("/", authModule());

// Better Auth mounts its full API (sign-up, sign-in/username, sign-out,
// session, is-username-available, …) under /api/auth.
app.on(["POST", "GET"], "/api/auth/*", async (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

// Current user profile + preferences (session required).
app.get("/api/me", withSession(), async (c) => {
  const orm = c.get("orm");
  const userId = c.get("userId");
  const rows = await orm
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      displayUsername: user.displayUsername,
      displayUnit: settings.displayUnit,
      theme: settings.theme,
    })
    .from(user)
    .leftJoin(settings, eq(settings.userId, user.id))
    .where(eq(user.id, userId))
    .limit(1);
  const me = rows[0];
  if (!me) {
    return c.json({ error: { code: "not_found", message: "کاربر پیدا نشد." } }, 404);
  }
  return c.json({
    me: { ...me, displayUnit: me.displayUnit ?? "toman", theme: me.theme ?? "light" },
  });
});

app.route("/", authModule());
app.route("/", dashboardModule());
app.route("/", accountsModule());
app.route("/", transactionsModule());
app.route("/", categoriesModule());
app.route("/", peopleModule());
app.route("/", debtsModule());
app.route("/", budgetsModule());
app.route("/", reportsModule());
app.route("/", settingsModule());

// Within the Worker (run_worker_first matches /api/* only), unknown paths
// get a JSON 404; all other paths are served as static SPA assets.
app.notFound((c) =>
  c.json({ error: { code: "not_found", message: "not found" } }, 404),
);

// Safe error envelope: no stack traces leak to clients.
app.onError((err, c) => {
  console.error("unhandled error:", err.message);
  return c.json(
    { error: { code: "internal", message: "خطای غیرمنتظره؛ دوباره تلاش کنید." } },
    500,
  );
});

export default app;
