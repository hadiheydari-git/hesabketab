// SQL that recomputes one account's cached balance from the single
// source of truth (opening + signed sum of non-deleted rows). Every
// transaction write pairs with this statement inside the same db.batch()
// so the cache can never drift (brief §3.3).
import { eq, sql } from "drizzle-orm";
import type { AppBindings } from "../env";
import { accounts } from "./schema";

export type WorkerDb = AppBindings["Variables"]["orm"];

const SIGN_CASE = sql.raw(`
CASE t.type
  WHEN 'INCOME' THEN t.amount_minor
  WHEN 'EXPENSE' THEN -t.amount_minor
  WHEN 'TRANSFER' THEN CASE t.transfer_leg WHEN 'to' THEN t.amount_minor WHEN 'from' THEN -t.amount_minor ELSE 0 END
  WHEN 'DEBT_BORROWED' THEN t.amount_minor
  WHEN 'DEBT_LENT' THEN -t.amount_minor
  WHEN 'REPAYMENT_PAID' THEN -t.amount_minor
  WHEN 'REPAYMENT_RECEIVED' THEN t.amount_minor
  ELSE 0
END`);

/**
 * One batch member: recompute `accountId`'s cached balance with a drizzle
 * UPDATE builder (batchable). The subquery is correlated to the row being
 * updated via account_entry.id.
 */
export function balanceRefresh(db: WorkerDb, accountId: string) {
  return db
    .update(accounts)
    .set({
      balanceMinor: sql`${accounts.openingBalanceMinor} + COALESCE((
        SELECT SUM(${SIGN_CASE})
        FROM "transaction" t
        WHERE t.account_id = ${accounts.id} AND t.deleted_at IS NULL
      ), 0)`,
    })
    .where(eq(accounts.id, accountId));
}
