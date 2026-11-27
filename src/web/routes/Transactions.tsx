// Transactions list: search, filters (type, account, category, Jalali
// range), soft delete with confirmation — everything real.
import { useState } from "react";
import { Link } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  CardBody,
  Dialog,
  EmptyState,
  Input,
  Select,
  Skeleton,
} from "@kashi-ui/react";
import { Page, PageHeader } from "../components/ui/Page";
import { MoneyText } from "../components/ui/MoneyText";
import { useAccounts, useCategories, useTransactions } from "../lib/queries";
import { formatJalali } from "@kashi-ui/persian";

const TYPE_LABELS: Record<string, string> = {
  INCOME: "درآمد",
  EXPENSE: "هزینه",
  TRANSFER: "انتقال",
  DEBT_BORROWED: "بدهی من",
  DEBT_LENT: "طلب من",
  REPAYMENT_PAID: "بازپرداخت بدهی",
  REPAYMENT_RECEIVED: "دریافت بازپرداخت",
};

export function Transactions() {
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [fromDay, setFromDay] = useState("");
  const [toDay, setToDay] = useState("");
  const [page, setPage] = useState(1);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const qc = useQueryClient();

  const tx = useTransactions({ q, type, accountId, categoryId, fromDay, toDay, page: String(page) });
  const accounts = useAccounts();
  const categories = useCategories();

  const remove = async () => {
    if (!confirmId) return;
    await fetch(`/api/transactions/${confirmId}`, { method: "DELETE", credentials: "same-origin" });
    setConfirmId(null);
    await qc.invalidateQueries({ queryKey: ["transactions"] });
    await qc.invalidateQueries({ queryKey: ["accounts"] });
    await qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const rows = tx.data?.transactions ?? [];
  const total = tx.data?.total ?? 0;
  const pageSize = tx.data?.pageSize ?? 25;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Page>
      <PageHeader
        title="تراکنش‌ها"
        action={
          <Button variant="primary" as={Link} href="/transactions/new">
            ثبت تراکنش
          </Button>
        }
      />

      <Card style={{ marginBlockEnd: 24 }}>
        <CardBody style={{ display: "grid", gap: 12 }}>
          <Input
            label="جستجو در یادداشت‌ها"
            value={q}
            onInput={(e) => {
              setQ((e.target as HTMLInputElement).value);
              setPage(1);
            }}
            clearable
            onClear={() => setQ("")}
          />
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <Select
              label="نوع"
              placeholder="همه"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
              options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
            />
            <Select
              label="حساب"
              placeholder="همه"
              value={accountId}
              onChange={(e) => {
                setAccountId(e.target.value);
                setPage(1);
              }}
              options={(accounts.data?.accounts ?? []).map((a) => ({ value: a.id, label: a.name }))}
            />
            <Select
              label="دسته‌بندی"
              placeholder="همه"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
              options={(categories.data?.categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
            <Input
              label="از تاریخ"
              variant="code"
              dir="ltr"
              placeholder="۱۴۰۵-۰۹-۰۱"
              value={fromDay}
              onInput={(e) => setFromDay((e.target as HTMLInputElement).value)}
            />
            <Input
              label="تا تاریخ"
              variant="code"
              dir="ltr"
              placeholder="۱۴۰۵-۰۹-۳۰"
              value={toDay}
              onInput={(e) => setToDay((e.target as HTMLInputElement).value)}
            />
          </div>
        </CardBody>
      </Card>

      {tx.isLoading ? (
        <Skeleton height={320} />
      ) : rows.length === 0 ? (
        <EmptyState
          preset="noResults"
          title="تراکنشی با این شرایط نیست"
          actions={
            <Button variant="primary" as={Link} href="/transactions/new">
              ثبت تراکنش
            </Button>
          }
        />
      ) : (
        <Card>
          <CardBody style={{ display: "grid", gap: 0, padding: 0 }}>
            {rows.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 24px",
                  borderBottom: "1px solid var(--k-color-border, #e2e6ec)",
                }}
              >
                <div style={{ flex: 1, display: "grid", gap: 2 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Badge tone={t.type === "INCOME" ? "success" : t.type === "EXPENSE" ? "error" : "neutral"}>
                      {TYPE_LABELS[t.type] ?? t.type}
                    </Badge>
                    <span style={{ fontSize: 13, color: "var(--k-color-fg-muted, #5b6676)" }}>
                      {formatJalali(new Date(t.occurredAt))}
                    </span>
                  </div>
                  <span style={{ fontSize: 13 }}>
                    {t.note || TYPE_LABELS[t.type]}
                  </span>
                </div>
                <MoneyText
                  rial={t.amountMinor}
                  tone={t.type === "INCOME" ? "positive" : t.type === "EXPENSE" ? "negative" : "neutral"}
                />
                <Button as={Link} href={`/transactions/${t.id}/edit`} size="sm" variant="tertiary">
                  ویرایش
                </Button>
                <Button size="sm" variant="tertiary" onClick={() => setConfirmId(t.id)}>
                  حذف
                </Button>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {pages > 1 ? (
        <div style={{ display: "flex", gap: 12, justifyContent: "center", paddingBlock: 16 }}>
          <Button size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            قبلی
          </Button>
          <span style={{ alignSelf: "center", fontSize: 14 }}>
            صفحه {page} از {pages}
          </span>
          <Button size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            بعدی
          </Button>
        </div>
      ) : null}

      <Dialog
        open={confirmId !== null}
        onOpenChange={(open) => !open && setConfirmId(null)}
        title="حذف تراکنش"
        description="تراکنش از موجودی حساب کم می‌شود اما تاریخچه حفظ می‌شود. مطمئنید؟"
        tone="danger"
        footer={
          <>
            <Button variant="tertiary" onClick={() => setConfirmId(null)}>
              انصراف
            </Button>
            <Button variant="danger" onClick={remove}>
              حذف
            </Button>
          </>
        }
      />
    </Page>
  );
}
