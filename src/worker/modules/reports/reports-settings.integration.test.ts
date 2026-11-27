// Integration tests for reports and settings: honest aggregation over
// real transactions, previous-period comparison, preferences, password
// change, export and full account deletion.
import { SELF, env } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

type CookieJar = Record<string, string>;

function absorbCookies(jar: CookieJar, res: Response): void {
  for (const line of res.headers.getSetCookie()) {
    const [pair] = line.split(";");
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    jar[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
}
const cookieHeader = (jar: CookieJar) => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");

const post = (path: string, data: unknown, jar?: CookieJar): Promise<Response> =>
  SELF.fetch(`https://example.com${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(jar ? { cookie: cookieHeader(jar) } : {}) },
    body: JSON.stringify(data),
  });
const patch = (path: string, data: unknown, jar: CookieJar): Promise<Response> =>
  SELF.fetch(`https://example.com${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: cookieHeader(jar) },
    body: JSON.stringify(data),
  });
const get = (path: string, jar: CookieJar): Promise<Response> =>
  SELF.fetch(`https://example.com${path}`, { headers: { cookie: cookieHeader(jar) } });

let counter = 0;
const unique = (base: string) => `${base}${Date.now().toString(36)}${(counter += 1)}`;

async function newUser(): Promise<CookieJar> {
  const username = unique("rs");
  const res = await post("/api/auth/sign-up/email", {
    email: `${username}@users.invalid`,
    name: username,
    username,
    password: "test-password-123",
  });
  expect(res.status).toBe(200);
  const jar: CookieJar = {};
  absorbCookies(jar, res);
  return jar;
}

const TABLES = [
  "recovery_code", "rate_limit", "budget_category", "budget", "transaction",
  "debt", "person", "category", "account_entry", "settings", "session",
  "account", "verification", "user",
];
beforeEach(async () => {
  for (const t of TABLES) await env.DB.prepare(`DELETE FROM "${t}"`).run();
});
afterEach(async () => {
  for (const t of TABLES) await env.DB.prepare(`DELETE FROM "${t}"`).run();
});

describe("reports", () => {
  it("aggregates income/expense honestly and compares with the previous period", async () => {
    const jar = await newUser();
    const acc = (
      (await (await post("/api/accounts", { name: "نقد", type: "cash", openingBalanceMinor: 0 }, jar)).json()) as {
        account: { id: string };
      }
    ).account.id;
    const cats = (await (await get("/api/categories", jar)).json()) as { categories: { id: string; kind: string; name: string }[] };
    const food = cats.categories.find((c) => c.name === "خوراک و مواد غذایی")!.id;

    // Two months: Mehr (1405-07) and Aban (1405-08).
    await post("/api/transactions", { type: "INCOME", accountId: acc, amountMinor: 2_000_000, dayKey: "1405-07-10" }, jar);
    await post("/api/transactions", { type: "EXPENSE", accountId: acc, amountMinor: 1_000_000, dayKey: "1405-07-15", categoryId: food }, jar);
    await post("/api/transactions", { type: "INCOME", accountId: acc, amountMinor: 3_000_000, dayKey: "1405-08-05" }, jar);
    await post("/api/transactions", { type: "EXPENSE", accountId: acc, amountMinor: 900_000, dayKey: "1405-08-20", categoryId: food }, jar);

    const res = await get("/api/reports/summary?fromDay=1405-08-01&toDay=1405-08-30", jar);
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      totals: { incomeMinor: number; expenseMinor: number; netMinor: number };
      previous: { incomeMinor: number; expenseMinor: number };
      byCategory: { name: string; amountMinor: number }[];
      cashFlow: { dayKey: string; income: number; expense: number }[];
    };
    expect(data.totals.incomeMinor).toBe(3_000_000);
    expect(data.totals.expenseMinor).toBe(900_000);
    expect(data.totals.netMinor).toBe(2_100_000);
    expect(data.previous.incomeMinor).toBe(2_000_000);
    expect(data.previous.expenseMinor).toBe(1_000_000);
    expect(data.byCategory[0]!.name).toBe("خوراک و مواد غذایی");
    expect(data.cashFlow).toHaveLength(2); // 1405-08-05 income day + 1405-08-20 expense day

    // Transfers never leak into the totals.
    const acc2 = (
      (await (await post("/api/accounts", { name: "دوم", type: "bank", openingBalanceMinor: 0 }, jar)).json()) as {
        account: { id: string };
      }
    ).account.id;
    await post("/api/transactions", { type: "TRANSFER", accountId: acc, toAccountId: acc2, amountMinor: 500_000, dayKey: "1405-08-25" }, jar);
    const again = (await (await get("/api/reports/summary?fromDay=1405-08-01&toDay=1405-08-30", jar)).json()) as typeof data;
    expect(again.totals.incomeMinor).toBe(3_000_000);
    expect(again.totals.expenseMinor).toBe(900_000);
  });

  it("requires a session", async () => {
    const res = await SELF.fetch("https://example.com/api/reports/summary?fromDay=1405-08-01&toDay=1405-08-30");
    expect(res.status).toBe(401);
  });
});

describe("settings", () => {
  it("updates preferences and profile", async () => {
    const jar = await newUser();
    const patch1 = await patch("/api/me/settings", { displayUnit: "rial", theme: "dark" }, jar);
    expect(patch1.status).toBe(200);
    const me = (await (await get("/api/me", jar)).json()) as { me: { displayUnit: string; theme: string } };
    expect(me.me.displayUnit).toBe("rial");
    expect(me.me.theme).toBe("dark");

    const patch2 = await patch("/api/me", { name: "هدی کریمی" }, jar);
    expect(patch2.status).toBe(200);
    const me2 = (await (await get("/api/me", jar)).json()) as { me: { name: string } };
    expect(me2.me.name).toBe("هدی کریمی");
  });

  it("changes the password after verifying the current one", async () => {
    const jar = await newUser();
    const username = (await (await get("/api/me", jar)).json()) as { me: { username: string } };
    const bad = await post("/api/me/password", { currentPassword: "wrong-pass-123", newPassword: "brand-new-pass-9" }, jar);
    expect(bad.status).toBe(401);
    const good = await post("/api/me/password", { currentPassword: "test-password-123", newPassword: "brand-new-pass-9" }, jar);
    expect(good.status).toBe(200);
    const login = await post("/api/auth/sign-in/username", { username: username.me.username, password: "brand-new-pass-9" });
    expect(login.status).toBe(200);
  });

  it("exports all personal data as JSON", async () => {
    const jar = await newUser();
    await post("/api/accounts", { name: "نقد", type: "cash", openingBalanceMinor: 100_000 }, jar);
    const res = await get("/api/me/export", jar);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { accounts: unknown[]; transactions: unknown[]; categories: unknown[] };
    expect(data.accounts).toHaveLength(1);
    expect(data.categories.length).toBe(20);
  });

  it("deletes the account and every owned row, then invalidates the session", async () => {
    const jar = await newUser();
    await post("/api/accounts", { name: "نقد", type: "cash", openingBalanceMinor: 100_000 }, jar);
    const del = await post("/api/me/delete", {}, jar);
    expect(del.status).toBe(200);
    const after = await env.DB.prepare("SELECT COUNT(*) AS n FROM account_entry").first<{ n: number }>();
    expect(after!.n).toBe(0);
    const users = await env.DB.prepare("SELECT COUNT(*) AS n FROM user").first<{ n: number }>();
    expect(users!.n).toBe(0);
    const meAgain = await get("/api/me", jar);
    expect(meAgain.status).toBe(401);
  });
});
