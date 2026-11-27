// Password reset without email: username + one-time recovery code + new
// password. Losing both the password and the codes means the account
// cannot be recovered — stated plainly in the UI (brief §3.4).
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Alert, Button, Card, CardBody, Input } from "@kashi-ui/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { postJson } from "../lib/api";

const schema = z.object({
  username: z.string().min(3, "نام کاربری را وارد کنید."),
  code: z.string().min(8, "کد بازیابی را وارد کنید."),
  newPassword: z.string().min(8, "رمز تازه دست‌کم ۸ نویسه است."),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPassword() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", code: "", newPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await postJson("/api/auth/forgot-password", values);
      navigate("/login", { replace: true });
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "بازیابی رمز انجام نشد؛ دوباره تلاش کنید.",
      );
    }
  });

  return (
    <div className="auth-shell">
      <Card className="auth-card">
        <CardBody style={{ display: "grid", gap: 24 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <h1 className="auth-title">بازیابی رمز عبور</h1>
            <p className="auth-subtitle">یکی از کدهای بازیابی یک‌بارمصرف را وارد کنید</p>
          </div>

          {serverError ? <Alert tone="error">{serverError}</Alert> : null}

          <form onSubmit={onSubmit} noValidate style={{ display: "grid", gap: 16 }}>
            <Input
              label="نام کاربری"
              variant="code"
              autoComplete="username"
              dir="ltr"
              error={errors.username?.message}
              {...register("username")}
            />
            <Input
              label="کد بازیابی"
              variant="code"
              dir="ltr"
              hint="به شکل abcd-2345؛ فاصله‌ها نادیده گرفته می‌شوند"
              error={errors.code?.message}
              {...register("code")}
            />
            <Input
              label="رمز عبور تازه"
              type="password"
              autoComplete="new-password"
              error={errors.newPassword?.message}
              {...register("newPassword")}
            />
            <Button type="submit" variant="primary" block loading={isSubmitting}>
              تغییر رمز عبور
            </Button>
          </form>

          <Alert tone="warning" size="sm">
            اگر رمز عبور و کدهای بازیابی را هر دو از دست بدهید، بازیابی حساب ممکن نیست.
          </Alert>

          <p style={{ margin: 0, textAlign: "center", fontSize: 14 }}>
            <Link to="/login">بازگشت به ورود</Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
