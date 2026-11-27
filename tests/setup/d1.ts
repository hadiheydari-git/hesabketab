// Applies the real drizzle migrations to the local D1 database once
// (singleWorker). SQL files are imported as text via the pool's
// moduleRules (tests/wrangler.test.jsonc only carries bindings; module
// rules come from vitest.config.ts).
import { applyD1Migrations, env } from "cloudflare:test";
import initSql from "../../drizzle/0000_init.sql";
import rateLimitSql from "../../drizzle/0001_rate_limit.sql";

function splitStatements(sql: string): string[] {
  return sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
}

await applyD1Migrations(env.DB, [
  { name: "0000_init", queries: splitStatements(initSql) },
  { name: "0001_rate_limit", queries: splitStatements(rateLimitSql) },
]);
