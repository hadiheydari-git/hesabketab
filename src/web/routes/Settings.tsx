// Settings hub: profile, preferences (unit + theme), categories, security
// (password + recovery codes), data management (export + delete account).
import { useState } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CopyButton,
  Dialog,
  Input,
  SegmentedControl,
  Skeleton,
  toast,
} from "@kashi-ui/react";
import { Page, PageHeader } from "../components/ui/Page";
import { useMe } from "../lib/me";
import { useCategories } from "../lib/queries";

export function Settings() {
  const me = useMe();
  const categories = useCategories(true);
  const qc = useQueryClient();
  const [name, setName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const data = me.data?.me;
  const effectiveName = name ?? data?.name ?? "";

  const saveName = async () => {
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ name: effectiveName }),
    });
    if (res.ok) {
      setSaved(true);
      toast.success("ذخیره شد");
      await qc.invalidateQueries({ queryKey: ["me"] });
    }
  };

  const savePrefs = async (patch: { displayUnit?: string; theme?: string }) => {
    await fetch("/api/me/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(patch),
    });
    await qc.invalidateQueries({ queryKey: ["me"] });
    if (patch.theme) {
      document.documentElement.setAttribute("data-theme", patch.theme);
      document.documentElement.style.colorScheme = patch.theme;
    }
    toast.success("به‌روزرسانی شد");
  };

  const changePassword = async () => {
    setPasswordMsg(null);
    const res = await fetch("/api/me/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: { message: string } };
    if (!res.ok) {
      setPasswordMsg(body.error?.message ?? "تغییر رمز انجام نشد.");
      return;
    }
    setPasswordMsg("رمز عبور تغییر کرد.");
    setCurrentPassword("");
    setNewPassword("");
    toast.success("رمز عبور تغییر کرد");
  };

  const regenerateCodes = async () => {
    const res = await fetch("/api/recovery-codes", { method: "POST", credentials: "same-origin" });
    const body = (await res.json().catch(() => ({}))) as { codes?: string[] };
    if (body.codes) setCodes(body.codes);
  };

  const exportData = async () => {
    const res = await fetch("/api/me/export", { credentials: "same-origin" });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dakholvakharj-export.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteAccount = async () => {
    await fetch("/api/me/delete", { method: "POST", credentials: "same-origin" });
    window.location.href = "/login";
  };

  if (me.isLoading || !data) {
    return (
      <Page>
        <PageHeader title="تنظیمات" />
        <Skeleton height={300} />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="تنظیمات" />

      <div style={{ display: "grid", gap: 24, maxWidth: 640 }}>
        <Card>
          <CardBody style={{ display: "grid", gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>نمایه</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ color: "var(--k-color-fg-muted, #5b6676)" }}>نام کاربری:</span>
              <span dir="ltr">{data.displayUsername ?? data.username}</span>
              <Badge>غیرقابل تغییر</Badge>
            </div>
            <Input label="نام نمایشی" value={effectiveName} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Button variant="primary" onClick={saveName} disabled={!effectiveName.trim()}>
                ذخیره
              </Button>
              {saved ? <Badge tone="success">ذخیره شد</Badge> : null}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ display: "grid", gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>ترجیح‌ها</h2>
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 14 }}>واحد نمایش مبالغ</p>
              <SegmentedControl
                options={[
                  { value: "toman", label: "تومان" },
                  { value: "rial", label: "ریال" },
                ]}
                value={data.displayUnit}
                onChange={(v) => savePrefs({ displayUnit: v })}
                block
              />
            </div>
            <div>
              <p style={{ margin: "0 0 8px", fontSize: 14 }}>پوسته</p>
              <SegmentedControl
                options={[
                  { value: "light", label: "روشن" },
                  { value: "dark", label: "تاریک" },
                ]}
                value={data.theme}
                onChange={(v) => savePrefs({ theme: v })}
                block
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ display: "grid", gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>
              دسته‌بندی‌ها{" "}
              <Link to="/transactions" style={{ fontSize: 13, fontWeight: 400 }}>
                (استفاده در تراکنش‌ها)
              </Link>
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: "var(--k-color-fg-muted, #5b6676)" }}>
              {(categories.data?.categories ?? []).filter((c) => !c.archivedAt).length} دسته‌بندی فعال از
              {" "}
              {(categories.data?.categories ?? []).length} دسته
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ display: "grid", gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>امنیت</h2>
            {passwordMsg ? <Alert tone="info">{passwordMsg}</Alert> : null}
            <Input
              label="رمز عبور فعلی"
              type="password"
              value={currentPassword}
              onInput={(e) => setCurrentPassword((e.target as HTMLInputElement).value)}
            />
            <Input
              label="رمز عبور تازه"
              type="password"
              value={newPassword}
              onInput={(e) => setNewPassword((e.target as HTMLInputElement).value)}
              hint="دست‌کم ۸ نویسه"
            />
            <Button variant="primary" onClick={changePassword} disabled={!currentPassword || newPassword.length < 8}>
              تغییر رمز عبور
            </Button>

            {codes ? (
              <div style={{ display: "grid", gap: 8 }}>
                <Alert tone="warning">
                  کدهای تازه فقط همین یک بار نمایش داده می‌شوند؛ آن‌ها را در جای امن ذخیره کنید. کدهای قبلی باطل شدند.
                </Alert>
                {codes.map((c) => (
                  <div key={c} dir="ltr" style={{ display: "flex", justifyContent: "space-between" }}>
                    <code>{c}</code>
                    <CopyButton value={c} size="sm" />
                  </div>
                ))}
              </div>
            ) : (
              <Button variant="secondary" onClick={regenerateCodes}>
                ساخت کدهای بازیابی تازه
              </Button>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody style={{ display: "grid", gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>داده‌ها</h2>
            <Button variant="secondary" onClick={exportData}>
              دریافت خروجی کامل (JSON)
            </Button>
            <Button variant="danger-secondary" onClick={() => setDeleteOpen(true)}>
              حذف کامل حساب
            </Button>
          </CardBody>
        </Card>
      </div>

      <Dialog
        open={deleteOpen}
        onOpenChange={(o) => !o && setDeleteOpen(false)}
        title="حذف کامل حساب"
        description="همهٔ حساب‌ها، تراکنش‌ها، بودجه‌ها و بدهی‌ها برای همیشه حذف می‌شوند و برگشتی در کار نیست. برای تأیید، عبارت «حذف حساب» را بنویسید."
        tone="danger"
        footer={
          <>
            <Button variant="tertiary" onClick={() => setDeleteOpen(false)}>
              انصراف
            </Button>
            <Button variant="danger" disabled={deleteConfirm !== "حذف حساب"} onClick={deleteAccount}>
              حذف همیشگی
            </Button>
          </>
        }
      >
        <Input value={deleteConfirm} onInput={(e) => setDeleteConfirm((e.target as HTMLInputElement).value)} label="تأیید" />
      </Dialog>
    </Page>
  );
}
