// Minimal authenticated placeholder so the auth flow is end-to-end
// testable. Stage 2 replaces this with the real dashboard shell.
import { useNavigate } from "react-router";
import { Button, Card, CardBody } from "@kashi-ui/react";
import { signOut, useSession } from "../lib/auth-client";

export function DashboardStub() {
  const navigate = useNavigate();
  const { data } = useSession();
  const username = data?.user?.displayUsername ?? data?.user?.username ?? "";

  return (
    <div className="auth-shell">
      <Card className="auth-card">
        <CardBody style={{ display: "grid", gap: 16, textAlign: "center" }}>
          <h1 className="auth-title">خوش آمدید</h1>
          <p style={{ margin: 0 }} dir="ltr">
            {username}
          </p>
          <p className="auth-subtitle">داشبورد در گام بعدی ساخته می‌شود.</p>
          <Button
            onClick={async () => {
              await signOut();
              navigate("/login", { replace: true });
            }}
          >
            خروج
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
