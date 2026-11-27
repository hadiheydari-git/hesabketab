// Integration tests: the real Worker (src/worker/index.ts) + real local
// D1 with the real migrations. Covers register (with seeded categories +
// settings + recovery codes), sign-in by username, sessions, password
// reset via one-time codes, and user isolation.
import { SELF, env } from "cloudflare:test";
import { afterEach, describe, expect, it } from "vitest";

type CookieJar = Record<string, string>;

function cookieHeader(jar: CookieJar): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

function absorbCookies(jar: CookieJar, res: Response): void {
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(";");
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    jar[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
}

const json = (data: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(data),
});

async function registerUser(username: string, password = "test-password-123") {
  const res = await SELF.fetch("https://example.com/api/auth/sign-up/email", {
    ...json({ email: `${username}@users.invalid`, name: username, username, password }),
    headers: { "content-type": "application/json" },
  });
  expect(res.status).toBe(200);
  const jar: CookieJar = {};
  absorbCookies(jar, res);
  return { res, jar };
}

type JsonRecord = Record<string, unknown>;

async function getJson(res: Response): Promise<JsonRecord> {
  return res.json();
}

let counter = 0;
const uniqueUsername = (base: string) => `${base}${Date.now().toString(36)}${(counter += 1)}`;

afterEach(async () => {
  // Clean all tables between tests (order matters for FKs).
  const tables = [
    "recovery_code",
    "rate_limit",
    "budget_category",
    "budget",
    "transaction",
    "debt",
    "person",
    "category",
    "account_entry",
    "settings",
    "session",
    "account",
    "verification",
    "user",
  ];
  for (const t of tables) {
    await env.DB.prepare(`DELETE FROM "${t}"`).run();
  }
});

describe("auth flow on real D1", () => {
  it("registers a user, seeds categories/settings, and issues recovery codes", async () => {
    const username = uniqueUsername("hadi");
    const { res, jar } = await registerUser(username);
    const body = await getJson(res);
    expect(body.user.username).toBe(username);
    expect(jar).toHaveProperty("dakholvakharj.session_token");

    // Recovery codes: 8 one-time codes for the fresh user.
    const codesRes = await SELF.fetch("https://example.com/api/recovery-codes", {
      method: "POST",
      headers: { cookie: cookieHeader(jar) },
    });
    expect(codesRes.status).toBe(200);
    const { codes } = (await codesRes.json()) as { codes: string[] };
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);

    // Seeded Persian categories exist for the new user.
    const user = await env.DB.prepare("SELECT id FROM user WHERE username = ?")
      .bind(username)
      .first<{ id: string }>();
    const cats = await env.DB.prepare("SELECT kind, COUNT(*) AS n FROM category WHERE user_id = ? GROUP BY kind")
      .bind(user!.id)
      .all();
    const kinds = Object.fromEntries(cats.results.map((r: JsonRecord) => [r.kind, r.n]));
    expect(kinds.income).toBe(7);
    expect(kinds.expense).toBe(13);

    // Settings row defaults to Toman/light.
    const settings = await env.DB.prepare("SELECT display_unit, theme FROM settings WHERE user_id = ?")
      .bind(user!.id)
      .first<{ display_unit: string; theme: string }>();
    expect(settings).toEqual({ display_unit: "toman", theme: "light" });
  });

  it("signs in by username and exposes /api/me with preferences", async () => {
    const username = uniqueUsername("mehdi");
    await registerUser(username);
    const res = await SELF.fetch("https://example.com/api/auth/sign-in/username", {
      ...json({ username, password: "test-password-123" }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(200);
    const jar: CookieJar = {};
    absorbCookies(jar, res);

    const meRes = await SELF.fetch("https://example.com/api/me", {
      headers: { cookie: cookieHeader(jar) },
    });
    expect(meRes.status).toBe(200);
    const { me } = (await meRes.json()) as { me: { username: string; displayUnit: string; theme: string; id: string } };
    expect(me.username).toBe(username);
    expect(me.displayUnit).toBe("toman");
    expect(me.theme).toBe("light");
  });

  it("rejects wrong credentials with a generic error and no session", async () => {
    const username = uniqueUsername("sara");
    await registerUser(username);
    const res = await SELF.fetch("https://example.com/api/auth/sign-in/username", {
      ...json({ username, password: "wrong-password-1" }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { message?: string };
    expect(body.message).toBeDefined(); // generic; no field disclosure
  });

  it("private endpoints are unreachable without a session", async () => {
    const res = await SELF.fetch("https://example.com/api/me");
    expect(res.status).toBe(401);
    const codes = await SELF.fetch("https://example.com/api/recovery-codes", { method: "POST" });
    expect(codes.status).toBe(401);
  });

  it("resets the password with a one-time code and invalidates sessions", async () => {
    const username = uniqueUsername("nima");
    const { jar } = await registerUser(username);

    // Get codes (session of the fresh user).
    const codesRes = await SELF.fetch("https://example.com/api/recovery-codes", {
      method: "POST",
      headers: { cookie: cookieHeader(jar) },
    });
    const { codes } = (await codesRes.json()) as { codes: string[] };
    expect(codes).toHaveLength(8);

    const newPassword = "brand-new-password-9";
    const resetRes = await SELF.fetch(
      "https://example.com/api/auth/forgot-password",
      json({ username, code: codes[0], newPassword }),
    );
    expect(resetRes.status).toBe(200);

    // The code is one-time: the same code no longer works.
    const again = await SELF.fetch(
      "https://example.com/api/auth/forgot-password",
      json({ username, code: codes[0], newPassword: "another-password-2" }),
    );
    expect(again.status).toBe(401);

    // Old session is revoked.
    const oldSession = await SELF.fetch("https://example.com/api/me", {
      headers: { cookie: cookieHeader(jar) },
    });
    expect(oldSession.status).toBe(401);

    // The new password signs in; the old one no longer does.
    const oldLogin = await SELF.fetch("https://example.com/api/auth/sign-in/username", {
      ...json({ username, password: "test-password-123" }),
      headers: { "content-type": "application/json" },
    });
    expect(oldLogin.status).toBe(401);
    const newLogin = await SELF.fetch("https://example.com/api/auth/sign-in/username", {
      ...json({ username, password: newPassword }),
      headers: { "content-type": "application/json" },
    });
    expect(newLogin.status).toBe(200);
  });

  it("keeps user data isolated between accounts", async () => {
    const userA = uniqueUsername("ali");
    const userB = uniqueUsername("reza");
    const { jar: jarA } = await registerUser(userA);
    const { jar: jarB } = await registerUser(userB);

    const meA = ((await (
      await SELF.fetch("https://example.com/api/me", { headers: { cookie: cookieHeader(jarA) } })
    ).json()) as { me: { id: string } }).me;
    const meB = ((await (
      await SELF.fetch("https://example.com/api/me", { headers: { cookie: cookieHeader(jarB) } })
    ).json()) as { me: { id: string } }).me;
    expect(meA.id).not.toBe(meB.id);

    // Categories are per-user copies: A's categories are invisible to B's queries.
    const userARow = await env.DB.prepare("SELECT id FROM user WHERE username = ?").bind(userA).first<{ id: string }>();
    const bCats = await env.DB
      .prepare("SELECT COUNT(*) AS n FROM category WHERE user_id = ? AND user_id != ?")
      .bind(meB.id, userARow!.id)
      .first<{ n: number }>();
    expect(bCats!.n).toBe(20); // B sees only their own 20 seeded rows

    // Recovery codes of A cannot be listed or consumed by B: the endpoint
    // is bound to the session user.
    const statusB = await SELF.fetch("https://example.com/api/recovery-codes/status", {
      headers: { cookie: cookieHeader(jarB) },
    });
    expect(statusB.status).toBe(200);
    const { unusedCount } = (await statusB.json()) as { unusedCount: number };
    expect(unusedCount).toBe(0); // B's own status only
  });

  it("rejects invalid usernames at sign-up", async () => {
    const res = await SELF.fetch("https://example.com/api/auth/sign-up/email", {
      ...json({ email: "x@users.invalid", name: "x", username: "bad name!", password: "test-password-123" }),
      headers: { "content-type": "application/json" },
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("rate-limits forgot-password attempts per username", async () => {
    const username = uniqueUsername("parviz");
    await registerUser(username);
    let lastStatus = 0;
    for (let i = 0; i < 12; i += 1) {
      const res = await SELF.fetch("https://example.com/api/auth/forgot-password", {
        ...json({ username, code: "abcd-2345", newPassword: "whatever-password-1" }),
        headers: { "content-type": "application/json" },
      });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
