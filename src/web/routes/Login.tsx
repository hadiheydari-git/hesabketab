// Login: username + password only — never an email (brief §3.4).
// Errors are generic and never reveal which part was wrong.
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Alert, Button, Card, CardBody, Input } from "@kashi-ui/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { APP_TITLE } from "../../shared/constants";
import { authClient } from "../lib/auth-client";
import { checkUsername } from "../../shared/domain/username";

const schema = z.object({
  username: z.string().refine((v) => checkUsername(v).ok, {
    message: "نام کاربری معتبر نیست.",
  }),
  password: z.string().min(8, "رمز عبور دست‌کم ۸ نویسه است."),
});

type FormValues = z.infer<typeof schema>;

export function Login() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { username: "", password: "" } });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const { error } = await authClient.signIn.username({
      username: values.username.trim().toLowerCase(),
      password: values.password,
    });
    if (error) {
      setServerError("نام کاربری یا رمز عبور درست نیست.");
      return;
    }
    navigate("/dashboard", { replace: true });
  });

  return (
    <div className="auth-shell">
      <Card className="auth-card">
        <CardBody style={{ display: "grid", gap: 24 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <h1 className="auth-title">{APP_TITLE}</h1>
            <p className="auth-subtitle">برای ادامه وارد شوید</p>
          </div>

          {serverError ? <Alert tone="error">{serverError}</Alert> : null}

          <form onSubmit={onSubmit} noValidate style={{ display: "grid", gap: 16 }}>
            <Input
              label="نام کاربری"
              variant="code"
              autoComplete="username"
              autoCapitalize="none"
              dir="ltr"
              error={errors.username?.message}
              {...register("username")}
            />
            <Input
              label="رمز عبور"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              labelEnd={<Link to="/forgot-password">بازیابی رمز</Link>}
              {...register("password")}
            />
            <Button type="submit" variant="primary" block loading={isSubmitting}>
              ورود
            </Button>
          </form>

          <p style={{ margin: 0, textAlign: "center", fontSize: 14 }}>
            حساب ندارید؟ <Link to="/register">ثبت‌نام</Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
