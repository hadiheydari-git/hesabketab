// App routes (docs/routes.md): auth pages are public, everything else
// requires a session (Stage 2 adds the full app shell + layout).
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { KashiProvider } from "@kashi-ui/react";
import { Toaster } from "@kashi-ui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RequireAuth } from "../components/RequireAuth";
import { Login } from "../routes/Login";
import { Register } from "../routes/Register";
import { ForgotPassword } from "../routes/ForgotPassword";
import { Dashboard } from "../routes/Dashboard";
import { Transactions } from "../routes/Transactions";
import { TransactionEdit, TransactionNew } from "../routes/TransactionForm";
import { AccountDetail, Accounts } from "../routes/Accounts";
import { Debts } from "../routes/Debts";
import { Budgets } from "../routes/Budgets";
import { People } from "../routes/People";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export function App() {
  return (
    <KashiProvider locale="fa">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route
              path="/dashboard"
              element={
                <RequireAuth>
                  <Dashboard />
                </RequireAuth>
              }
            />
            <Route
              path="/transactions"
              element={
                <RequireAuth>
                  <Transactions />
                </RequireAuth>
              }
            />
            <Route
              path="/transactions/new"
              element={
                <RequireAuth>
                  <TransactionNew />
                </RequireAuth>
              }
            />
            <Route
              path="/transactions/:id/edit"
              element={
                <RequireAuth>
                  <TransactionEdit />
                </RequireAuth>
              }
            />
            <Route
              path="/accounts"
              element={
                <RequireAuth>
                  <Accounts />
                </RequireAuth>
              }
            />
            <Route
              path="/accounts/new"
              element={
                <RequireAuth>
                  <Accounts />
                </RequireAuth>
              }
            />
            <Route
              path="/accounts/:id"
              element={
                <RequireAuth>
                  <AccountDetail />
                </RequireAuth>
              }
            />
            <Route
              path="/debts"
              element={
                <RequireAuth>
                  <Debts />
                </RequireAuth>
              }
            />
            <Route
              path="/debts/new"
              element={
                <RequireAuth>
                  <Debts />
                </RequireAuth>
              }
            />
            <Route
              path="/budgets"
              element={
                <RequireAuth>
                  <Budgets />
                </RequireAuth>
              }
            />
            <Route
              path="/budgets/new"
              element={
                <RequireAuth>
                  <Budgets />
                </RequireAuth>
              }
            />
            <Route
              path="/people"
              element={
                <RequireAuth>
                  <People />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          <Toaster placement="bottom-end" />
        </BrowserRouter>
      </QueryClientProvider>
    </KashiProvider>
  );
}
