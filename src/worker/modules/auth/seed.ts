// Seeds copied to every new user at registration (brief §4.3): the
// Persian income/expense categories plus a settings row (Toman default).
// Runs inside the Better Auth user.create.after hook.
import type { BatchItem } from "drizzle-orm/batch";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../db/schema";

export const SEED_CATEGORIES: ReadonlyArray<{ kind: "income" | "expense"; name: string }> = [
  { kind: "income", name: "حقوق و دستمزد" },
  { kind: "income", name: "درآمد پروژه" },
  { kind: "income", name: "درآمد فریلنسری" },
  { kind: "income", name: "فروش" },
  { kind: "income", name: "سود سرمایه‌گذاری" },
  { kind: "income", name: "هدیه" },
  { kind: "income", name: "سایر درآمدها" },
  { kind: "expense", name: "مسکن و اجاره" },
  { kind: "expense", name: "خوراک و مواد غذایی" },
  { kind: "expense", name: "حمل‌ونقل" },
  { kind: "expense", name: "پوشاک" },
  { kind: "expense", name: "سلامت و درمان" },
  { kind: "expense", name: "تفریح و سرگرمی" },
  { kind: "expense", name: "خریدهای شخصی" },
  { kind: "expense", name: "قبوض و خدمات" },
  { kind: "expense", name: "اینترنت و ارتباطات" },
  { kind: "expense", name: "آموزش" },
  { kind: "expense", name: "اقساط و بدهی" },
  { kind: "expense", name: "خانواده" },
  { kind: "expense", name: "سایر هزینه‌ها" },
];

function id(): string {
  return crypto.randomUUID();
}

/** Insert the seed categories and the settings row for a fresh user. */
export async function seedNewUser(
  db: DrizzleD1Database<typeof schema>,
  userId: string,
): Promise<void> {
  const now = new Date();
  const categoryRows = SEED_CATEGORIES.map((c) => ({
    id: id(),
    userId,
    kind: c.kind,
    name: c.name,
    icon: null,
    color: null,
    isSeed: true,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  }));
  // D1 caps bound parameters per statement, so chunk the multi-row insert
  // (10 columns → at most 8 rows per statement) and send every statement
  // in one batch: D1 has no interactive transactions (brief §3.3).
  const chunkSize = 8;
  const statements: BatchItem<"sqlite">[] = [
    db
      .insert(schema.settings)
      .values({ userId, displayUnit: "toman", theme: "light", createdAt: now, updatedAt: now }),
  ];
  for (let i = 0; i < categoryRows.length; i += chunkSize) {
    statements.push(db.insert(schema.categories).values(categoryRows.slice(i, i + chunkSize)));
  }
  await db.batch(statements as unknown as Parameters<typeof db.batch>[0]);
}
