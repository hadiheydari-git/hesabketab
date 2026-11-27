// Register: username + password (no email). On success the eight
// one-time recovery codes are fetched and shown exactly once, with a
// clear warning that losing both password and codes means the account
// cannot be recovered (brief §3.4).
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Alert, Button, Card, CardBody, Checkbox, CopyButton, Input } from "@kashi-ui/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { APP_TITLE } from "../../shared/constants";
import { authClient } from "../lib/auth-client";
import { postJson } from "../lib/api";
import { checkUsername, placeholderEmail } from "../../shared/domain/username";

const schema = z
  .object({
    username: z.string().refine((v) => checkUsername(v).ok, {
      message: "نام کاربری فقط حروف انگلیسی، رقم، نقطه و خط زیر و ۳ تا ۳۲ نویسه.",
    }),
    password: z.string().min(8, "رمز عبور دست‌کم ۸ نویسه است."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "تکرار رمز عبور با رمز عبور یکسان نیست.",
  });

type FormValues = z.infer<typeof schema>;

export function Register() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "", confirm: "" },
  });

  // After a successful sign-up the session cookie is already set; fetch
  // the codes right away so they are shown exactly once.
  useEffect(() => {
    if (!codes) return;
    document.title = "کدهای بازیابی — دخل‌وخرج";
  }, [codes]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const username = values.username.trim().toLowerCase();
    const { error } = await authClient.signUp.email({
      email: placeholderEmail(username),
      name: username,
      username,
      password: values.password,
    });
    if (error) {
      setServerError(
        error.code === "USERNAME_IS_ALREADY_TAKEN"
          ? "این نام کاربری قبلاً گرفته شده است."
          : "ثبت‌نام انجام نشد؛ اطلاعات را بررسی کنید.",
      );
      return;
    }
    try {
      const { codes: newCodes } = await postJson<{ codes: string[] }>("/api/recovery-codes", {});
      setCodes(newCodes);
    } catch {
      setServerError("ثبت‌نام انجام شد اما گرفتن کدهای بازیابی ناموفق بود؛ از تنظیمات، کدهای بازیابی را بسازید.");
      setCodes([]);
    }
  });

  if (codes) {
    return (
      <div className="auth-shell">
        <Card className="auth-card">
          <CardBody style={{ display: "grid", gap: 24 }}>
            <div style={{ display: "grid", gap: 8 }}>
              <h1 className="auth-title">کدهای بازیابی</h1>
              <Alert tone="warning">
                این کدها فقط همین یک بار نمایش داده می‌شوند. هر کد فقط یک بار قابل استفاده است. اگر رمز عبور و
                این کدها را هر دو از دست بدهید، بازیابی حساب ممکن نیست.
              </Alert>
            </div>
            {codes.length > 0 ? (
              <div style={{ display: "grid", gap: 8 }}>
                {codes.map((code) => (
                  <div
                    key={code}
                    dir="ltr"
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                  >
                    <code style={{ fontSize: 16, letterSpacing: 1 }}>{code}</code>
                    <CopyButton value={code} size="sm" />
                  </div>
                ))}
              </div>
            ) : null}
            <Checkbox
              checked={saved}
              onChange={(e) => setSaved(e.target.checked)}
              label="کدها را در جای امن ذخیره کردم"
            />
            <Button variant="primary" block disabled={!saved} onClick={() => navigate("/dashboard", { replace: true })}>
              ادامه
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <Card className="auth-card">
        <CardBody style={{ display: "grid", gap: 24 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <h1 className="auth-title">{APP_TITLE}</h1>
            <p className="auth-subtitle">با نام کاربری و رمز عبور ثبت‌نام کنید</p>
          </div>

          {serverError ? <Alert tone="error">{serverError}</Alert> : null}

          <form onSubmit={onSubmit} noValidate style={{ display: "grid", gap: 16 }}>
            <Input
              label="نام کاربری"
              variant="code"
              autoComplete="username"
              autoCapitalize="none"
              dir="ltr"
              hint="۳ تا ۳۲ نویسه؛ حروف انگلیسی، رقم، نقطه و خط زیر"
              error={errors.username?.message}
              {...register("username")}
            />
            <Input
              label="رمز عبور"
              type="password"
              autoComplete="new-password"
              error={errors.password?.message}
              {...register("password")}
            />
            <Input
              label="تکرار رمز عبور"
              type="password"
              autoComplete="new-password"
              error={errors.confirm?.message}
              {...register("confirm")}
            />
            <Button type="submit" variant="primary" block loading={isSubmitting}>
              ثبت‌نام
            </Button>
          </form>

          <p style={{ margin: 0, textAlign: "center", fontSize: 14 }}>
            قبلاً ثبت‌نام کرده‌اید؟ <Link to="/login">ورود</Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
