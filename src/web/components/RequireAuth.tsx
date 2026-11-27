// Route guard: redirects to /login when there is no session; shows a
// skeleton while the session is being resolved.
import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { Skeleton, Spinner } from "@kashi-ui/react";
import { useSession } from "../lib/auth-client";
import { AppLayout } from "./AppLayout";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { data, isPending } = useSession();

  if (isPending) {
    return (
      <div className="auth-shell">
        <div style={{ display: "grid", gap: 16, width: "100%", maxWidth: 420 }}>
          <Skeleton height={48} />
          <Skeleton height={200} />
          <Spinner aria-label="در حال بررسی نشست" />
        </div>
      </div>
    );
  }
  if (!data?.session) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}
