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
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          <Toaster placement="bottom-end" />
        </BrowserRouter>
      </QueryClientProvider>
    </KashiProvider>
  );
}
