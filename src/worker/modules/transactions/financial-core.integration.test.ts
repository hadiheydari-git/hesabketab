// Financial-core integration tests: balances follow the invariant after
// every write; transfers are atomic pairs that never touch income or
// expense; debts and repayments keep remaining balances correct; budgets
// track real spending; every resource is user-isolated.
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
const del = (path: string, jar: CookieJar): Promise<Response> =>
  SELF.fetch(`https://example.com${path}`, { method: "DELETE", headers: { cookie: cookieHeader(jar) } });
const get = (path: string, jar: CookieJar): Promise<Response> =>
  SELF.fetch(`https://example.com${path}`, { headers: { cookie: cookieHeader(jar) } });

let counter = 0;
const unique = (base: string) => `${base}${Date.now().toString(36)}${(counter += 1)}`;

async function newUser(): Promise<{ jar: CookieJar; username: string }> {
  const username = unique("fin");
  const res = await post("/api/auth/sign-up/email", {
    email: `${username}@users.invalid`,
    name: username,
    username,
    password: "test-password-123",
  });
  expect(res.status).toBe(200);
  const jar: CookieJar = {};
  absorbCookies(jar, res);
  return { jar, username };
}

async function makeAccount(jar: CookieJar, name: string, opening = 0) {
  const res = await post("/api/accounts", { name, type: "bank", openingBalanceMinor: opening }, jar);
  expect(res.status).toBe(201);
  return ((await res.json()) as { account: { id: string } }).account.id;
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

describe("accounts", () => {
  it("creates accounts and lists balances", async () => {
    const { jar } = await newUser();
    await makeAccount(jar, "بانک ملت", 5_000_000);
    const list = await get("/api/accounts", jar);
    const { accounts } = (await list.json()) as { accounts: { name: string; balanceMinor: number }[] };
    expect(accounts).toHaveLength(1);
    expect(accounts[0]!.name).toBe("بانک ملت");
    expect(accounts[0]!.balanceMinor).toBe(5_000_000);
  });

  it("keeps user B away from user A's account", async () => {
    const a = await newUser();
    const b = await newUser();
    const accountId = await makeAccount(a.jar, "حساب الف");
    const res = await get(`/api/accounts/${accountId}`, b.jar);
    expect(res.status).toBe(404);
  });
});

describe("transactions and balances", () => {
  it("income raises, expense lowers and the cached balance always equals the computed value", async () => {
    const { jar } = await newUser();
    const acc = await makeAccount(jar, "نقد", 1_000_000);
    const cat = (await (await get("/api/categories", jar)).json()) as { categories: { id: string; kind: string }[] };
    const expenseCat = cat.categories.find((c) => c.kind === "expense")!.id;

    await post("/api/transactions", { type: "INCOME", accountId: acc, amountMinor: 800_000, dayKey: "1405-09-01" }, jar);
    await post("/api/transactions", { type: "EXPENSE", accountId: acc, amountMinor: 300_000, dayKey: "1405-09-02", categoryId: expenseCat }, jar);

    const { account } = (await (await get(`/api/accounts/${acc}`, jar)).json()) as { account: { balanceMinor: number; openingBalanceMinor: number } };
    expect(account.balanceMinor).toBe(1_500_000);

    // Database-level invariant check: cache == opening + signed sum.
    const row = await env.DB.prepare(
      `SELECT a.balance_minor AS cached,
              a.opening_balance_minor + COALESCE((SELECT SUM(CASE t.type
                 WHEN 'INCOME' THEN t.amount_minor WHEN 'EXPENSE' THEN -t.amount_minor
                 ELSE 0 END)
               FROM "transaction" t WHERE t.account_id = a.id AND t.deleted_at IS NULL), 0) AS computed
       FROM account_entry a WHERE a.id = ?`,
    ).bind(acc).first<{ cached: number; computed: number }>();
    expect(row!.cached).toBe(row!.computed);
  });

  it("transfers move money between accounts atomically and never count as income or expense", async () => {
    const { jar } = await newUser();
    const from = await makeAccount(jar, "مبدأ", 2_000_000);
    const to = await makeAccount(jar, "مقصد", 100_000);

    const createRes = await post("/api/transactions", { type: "TRANSFER", accountId: from, toAccountId: to, amountMinor: 500_000, dayKey: "1405-09-03" }, jar);
    expect(createRes.status).toBe(201);

    const accounts = (await (await get("/api/accounts", jar)).json()) as { accounts: { id: string; balanceMinor: number }[] };
    const byId = new Map(accounts.accounts.map((a) => [a.id, a.balanceMinor]));
    expect(byId.get(from)).toBe(1_500_000);
    expect(byId.get(to)).toBe(600_000);

    // Exactly two legs sharing one transfer id.
    const legs = await env.DB.prepare(
      "SELECT COUNT(*) AS n, COUNT(DISTINCT transfer_id) AS t FROM \"transaction\" WHERE type = 'TRANSFER'",
    ).first<{ n: number; t: number }>();
    expect(legs!.n).toBe(2);
    expect(legs!.t).toBe(1);

    // Same day transfers must not exist as INCOME/EXPENSE rows.
    const incomes = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM \"transaction\" WHERE type IN ('INCOME','EXPENSE')",
    ).first<{ n: number }>();
    expect(incomes!.n).toBe(0);
  });

  it("editing and deleting transactions keeps balances honest (soft delete)", async () => {
    const { jar } = await newUser();
    const acc = await makeAccount(jar, "میزان", 0);
    const tx = await post("/api/transactions", { type: "INCOME", accountId: acc, amountMinor: 700_000, dayKey: "1405-09-05" }, jar);
    expect(tx.status).toBe(201);
    const { transactions } = (await (await get("/api/transactions", jar)).json()) as { transactions: { id: string }[] };
    const txId = transactions[0]!.id;

    await patch(`/api/transactions/${txId}`, { amountMinor: 900_000 }, jar);
    let { account } = (await (await get(`/api/accounts/${acc}`, jar)).json()) as { account: { balanceMinor: number } };
    expect(account.balanceMinor).toBe(900_000);

    await del(`/api/transactions/${txId}`, jar);
    ({ account } = (await (await get(`/api/accounts/${acc}`, jar)).json()) as { account: { balanceMinor: number } });
    expect(account.balanceMinor).toBe(0);

    // Soft delete: the row still exists with deleted_at set.
    const soft = await env.DB.prepare('SELECT deleted_at FROM "transaction" WHERE id = ?').bind(txId).first<{ deleted_at: number | null }>();
    expect(soft!.deleted_at).not.toBeNull();
  });

  it("rejects a transfer with the same source and destination", async () => {
    const { jar } = await newUser();
    const acc = await makeAccount(jar, "تنها");
    const res = await post("/api/transactions", { type: "TRANSFER", accountId: acc, toAccountId: acc, amountMinor: 100, dayKey: "1405-09-05" }, jar);
    expect(res.status).toBe(400);
  });

  it("user B cannot see or modify user A's transactions", async () => {
    const a = await newUser();
    const b = await newUser();
    const acc = await makeAccount(a.jar, "الف");
    await post("/api/transactions", { type: "INCOME", accountId: acc, amountMinor: 100_000, dayKey: "1405-09-01" }, a.jar);
    const { transactions } = (await (await get("/api/transactions", b.jar)).json()) as { transactions: unknown[] };
    expect(transactions).toHaveLength(0);
    const aTx = (await (await get("/api/transactions", a.jar)).json()) as { transactions: { id: string }[] };
    const delRes = await del(`/api/transactions/${aTx.transactions[0]!.id}`, b.jar);
    expect(delRes.status).toBe(404);
  });
});

describe("debts and receivables", () => {
  it("creates a debt with account movement, records repayment, settles at zero", async () => {
    const { jar } = await newUser();
    const acc = await makeAccount(jar, "بانک", 0);
    const person = (await (await post("/api/people", { name: "علی رضایی" }, jar)).json()) as { person: { id: string } };

    const debtRes = await post("/api/debts", {
      direction: "borrowed",
      personId: person.person.id,
      principalMinor: 2_000_000,
      accountId: acc,
      dueDayKey: "1405-10-01",
    }, jar);
    expect(debtRes.status).toBe(201);

    // The principal moved through the account (+2m) without being income.
    let { account } = (await (await get(`/api/accounts/${acc}`, jar)).json()) as { account: { balanceMinor: number } };
    expect(account.balanceMinor).toBe(2_000_000);

    const debtId = ((await (await get("/api/debts", jar)).json()) as { debts: { id: string; remainingMinor: number }[] }).debts[0]!.id;

    const rep1 = await post(`/api/debts/${debtId}/repayments`, { amountMinor: 1_200_000, accountId: acc, dayKey: "1405-09-20" }, jar);
    expect(rep1.status).toBe(201);
    ({ account } = (await (await get(`/api/accounts/${acc}`, jar)).json()) as { account: { balanceMinor: number } });
    expect(account.balanceMinor).toBe(800_000);

    let { debts } = (await (await get("/api/debts", jar)).json()) as { debts: { remainingMinor: number; settled: boolean }[] };
    expect(debts[0]!.remainingMinor).toBe(800_000);
    expect(debts[0]!.settled).toBe(false);

    const rep2 = await post(`/api/debts/${debtId}/repayments`, { amountMinor: 800_000, accountId: acc, dayKey: "1405-10-01" }, jar);
    expect(rep2.status).toBe(201);
    ({ debts } = (await (await get("/api/debts", jar)).json()) as { debts: { remainingMinor: number; settled: boolean }[] });
    expect(debts[0]!.settled).toBe(true);

    // Repaying beyond the remaining balance is rejected.
    const rep3 = await post(`/api/debts/${debtId}/repayments`, { amountMinor: 500_000, accountId: acc, dayKey: "1405-10-02" }, jar);
    expect(rep3.status).toBe(400);
  });

  it("marks overdue debts and isolates them per user", async () => {
    const a = await newUser();
    const b = await newUser();
    const person = (await (await post("/api/people", { name: "مریم" }, a.jar)).json()) as { person: { id: string } };
    await post("/api/debts", { direction: "lent", personId: person.person.id, principalMinor: 500_000, dueDayKey: "1404-01-01" }, a.jar);
    const aDebts = (await (await get("/api/debts", a.jar)).json()) as { debts: { overdue: boolean; remainingMinor: number }[] };
    expect(aDebts.debts[0]!.overdue).toBe(true);
    expect(aDebts.debts[0]!.remainingMinor).toBe(500_000);
    const bDebts = (await (await get("/api/debts", b.jar)).json()) as { debts: unknown[] };
    expect(bDebts.debts).toHaveLength(0);
  });
});

describe("budgets", () => {
  it("tracks real spending with warning and exceeded states", async () => {
    const { jar } = await newUser();
    const acc = await makeAccount(jar, "نقد");
    const cat = (await (await get("/api/categories", jar)).json()) as { categories: { id: string; kind: string; name: string }[] };
    const food = cat.categories.find((c) => c.name === "خوراک و مواد غذایی")!.id;

    await post("/api/budgets", { monthKey: "1405-09", limitMinor: 1_000_000, categoryIds: [food] }, jar);
    await post("/api/transactions", { type: "EXPENSE", accountId: acc, amountMinor: 850_000, dayKey: "1405-09-10", categoryId: food }, jar);
    let { budgets } = (await (await get("/api/budgets", jar)).json()) as { budgets: { actualMinor: number; state: string; percent: number }[] };
    expect(budgets[0]!.actualMinor).toBe(850_000);
    expect(budgets[0]!.state).toBe("warning");
    expect(budgets[0]!.percent).toBeCloseTo(85);

    await post("/api/transactions", { type: "EXPENSE", accountId: acc, amountMinor: 300_000, dayKey: "1405-09-11", categoryId: food }, jar);
    ({ budgets } = (await (await get("/api/budgets", jar)).json()) as { budgets: { actualMinor: number; state: string; percent: number }[] });
    expect(budgets[0]!.actualMinor).toBe(1_150_000);
    expect(budgets[0]!.state).toBe("exceeded");

    // A transfer must not feed the budget.
    const other = await makeAccount(jar, "دوم");
    await post("/api/transactions", { type: "TRANSFER", accountId: acc, toAccountId: other, amountMinor: 400_000, dayKey: "1405-09-12" }, jar);
    ({ budgets } = (await (await get("/api/budgets", jar)).json()) as { budgets: { actualMinor: number; state: string; percent: number }[] });
    expect(budgets[0]!.actualMinor).toBe(1_150_000);
  });

  it("rejects budgets with categories that belong to another user", async () => {
    const a = await newUser();
    const b = await newUser();
    const cat = (await (await get("/api/categories", a.jar)).json()) as { categories: { id: string }[] };
    const res = await post("/api/budgets", { monthKey: "1405-09", limitMinor: 100_000, categoryIds: [cat.categories[0]!.id] }, b.jar);
    expect(res.status).toBe(404);
  });
});

describe("categories and people", () => {
  it("archives categories and creates people inline", async () => {
    const { jar } = await newUser();
    const created = await post("/api/categories", { kind: "expense", name: "قهوه" }, jar);
    expect(created.status).toBe(201);
    const { categories } = (await (await get("/api/categories", jar)).json()) as { categories: { id: string; name: string; archivedAt: null }[] };
    const mine = categories.find((c) => c.name === "قهوه")!;
    await post(`/api/categories/${mine.id}/archive`, { archived: true }, jar);
    const active = (await (await get("/api/categories", jar)).json()) as { categories: { name: string }[] };
    expect(active.categories.find((c) => c.name === "قهوه")).toBeUndefined();
    const all = (await (await get("/api/categories?includeArchived=1", jar)).json()) as { categories: { name: string }[] };
    expect(all.categories.find((c) => c.name === "قهوه")).toBeDefined();
  });
});
