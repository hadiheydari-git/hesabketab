// React Query hooks for the financial-core resources.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, postJson } from "./api";
import type { AccountEntry, Budget, Category, Debt, Person, Transaction } from "../../worker/db/schema";

const json = <T,>(path: string) => () => api<T>(path);

export type AccountDto = Omit<AccountEntry, "createdAt" | "updatedAt" | "archivedAt" | "deletedAt"> & {
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
};
export type CategoryDto = Omit<Category, "createdAt" | "updatedAt" | "archivedAt" | "deletedAt"> & {
  kind: "income" | "expense";
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
};
export type PersonDto = Omit<Person, "createdAt" | "updatedAt" | "deletedAt"> & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
export type TransactionDto = Omit<Transaction, "occurredAt" | "createdAt" | "updatedAt" | "deletedAt"> & {
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
export type DebtDto = Omit<Debt, "createdAt" | "updatedAt" | "deletedAt"> & {
  direction: "borrowed" | "lent";
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  remainingMinor: number;
  settled: boolean;
  overdue: boolean;
};
export type BudgetDto = Omit<Budget, "createdAt" | "updatedAt" | "deletedAt"> & {
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  categories: string[];
  categoryIds: string[];
  actualMinor: number;
  percent: number;
  state: "ok" | "warning" | "exceeded";
  remainingMinor: number;
};

export function useAccounts(includeArchived = false) {
  return useQuery({
    queryKey: ["accounts", includeArchived],
    queryFn: json<{ accounts: AccountDto[] }>(`/api/accounts${includeArchived ? "?includeArchived=1" : ""}`),
  });
}
export function useCategories(includeArchived = false) {
  return useQuery({
    queryKey: ["categories", includeArchived],
    queryFn: json<{ categories: CategoryDto[] }>(`/api/categories${includeArchived ? "?includeArchived=1" : ""}`),
  });
}
export function usePeople() {
  return useQuery({ queryKey: ["people"], queryFn: json<{ people: PersonDto[] }>("/api/people") });
}
export function useTransactions(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== "") as [string, string][],
  ).toString();
  return useQuery({
    queryKey: ["transactions", qs],
    queryFn: json<{ transactions: TransactionDto[]; total: number; page: number; pageSize: number }>(
      `/api/transactions${qs ? `?${qs}` : ""}`,
    ),
  });
}
export type TransactionDetailDto = TransactionDto & { toAccountId: string | null };
export function useTransaction(id: string) {
  return useQuery({
    queryKey: ["transaction", id],
    queryFn: json<{ transaction: TransactionDetailDto }>(`/api/transactions/${id}`),
  });
}
export function useDebts() {
  return useQuery({ queryKey: ["debts"], queryFn: json<{ debts: DebtDto[] }>("/api/debts") });
}
export function useDebt(id: string) {
  return useQuery({
    queryKey: ["debt", id],
    queryFn: json<{ debt: DebtDto; repayments: TransactionDto[] }>(`/api/debts/${id}`),
  });
}
export function useBudgets() {
  return useQuery({ queryKey: ["budgets"], queryFn: json<{ budgets: BudgetDto[] }>("/api/budgets") });
}

/** Mutation wrapper: invalidates the given query keys after success. */
export function useAction<T>(fn: (data: T) => Promise<unknown>, keys: string[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] })));
    },
  });
}

export { postJson, api };
