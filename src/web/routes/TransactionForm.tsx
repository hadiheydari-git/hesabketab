// Quick entry + edit form (brief §5.2 flow 2): amount autofocus, category
// select by type, account, Jalali day key; advanced fields under
// «جزئیات بیشتر». Transfer shows from/to account selects. The inner form
// is remounted with initial values so editing never needs setState in an
// effect.
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Input,
  PriceInput,
  SegmentedControl,
  Select,
  Skeleton,
  Textarea,
} from "@kashi-ui/react";
import { Page, PageHeader } from "../components/ui/Page";
import { useAccounts, useCategories, usePeople, useTransaction, useTransactions, type TransactionDetailDto } from "../lib/queries";
import { tomanToRial } from "../../shared/domain/money";
import { dayKeyOf } from "../../shared/domain/jalali";
import type { TransactionType } from "../../shared/domain/finance";

const TYPES: { value: TransactionType; label: string }[] = [
  { value: "EXPENSE", label: "هزینه" },
  { value: "INCOME", label: "درآمد" },
  { value: "TRANSFER", label: "انتقال" },
];

type Initial = {
  type: TransactionType;
  amountToman: number | null;
  accountId: string;
  toAccountId: string;
  categoryId: string;
  dayKey: string;
  note: string;
  personId: string;
  paymentMethod: string;
};

function Inner({ initial, editId }: { initial: Initial; editId?: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [type, setType] = useState<TransactionType>(initial.type);
  const [amountToman, setAmountToman] = useState<number | null>(initial.amountToman);
  const [accountId, setAccountId] = useState(initial.accountId);
  const [toAccountId, setToAccountId] = useState(initial.toAccountId);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [dayKey, setDayKey] = useState(initial.dayKey);
  const [note, setNote] = useState(initial.note);
  const [personId, setPersonId] = useState(initial.personId);
  const [paymentMethod, setPaymentMethod] = useState(initial.paymentMethod);
  const [detailsOpen, setDetailsOpen] = useState(Boolean(initial.personId || initial.paymentMethod));
  const [serverError, setServerError] = useState<string | null>(null);

  const accounts = useAccounts();
  const categories = useCategories();
  const people = usePeople();

  const relevantCategories = (categories.data?.categories ?? []).filter((c) =>
    type === "INCOME" ? c.kind === "income" : c.kind === "expense",
  );

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        type,
        accountId,
        amountMinor: tomanToRial(amountToman ?? 0),
        dayKey,
        categoryId: type === "TRANSFER" ? null : categoryId || null,
        personId: personId || null,
        paymentMethod: paymentMethod || null,
        note: note || null,
      };
      if (type === "TRANSFER") body.toAccountId = toAccountId;
      const res = await fetch(editId ? `/api/transactions/${editId}` : "/api/transactions", {
        method: editId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const out = (await res.json().catch(() => ({}))) as { error?: { message: string } };
      if (!res.ok) throw new Error(out.error?.message ?? "ثبت انجام نشد.");
      return out;
    },
    onSuccess: async () => {
      await Promise.all(
        ["transactions", "accounts", "dashboard", "debts", "budgets"].map((k) =>
          qc.invalidateQueries({ queryKey: [k] }),
        ),
      );
      navigate("/transactions", { replace: true });
    },
    onError: (err: Error) => setServerError(err.message),
  });

  const canSave = Boolean(accountId && (amountToman ?? 0) > 0 && (type !== "TRANSFER" || toAccountId));

  return (
    <Page>
      <PageHeader title={editId ? "ویرایش تراکنش" : "ثبت تراکنش"} />

      <Card className="auth-card" style={{ maxWidth: 560 }}>
        <CardBody style={{ display: "grid", gap: 20 }}>
          {serverError ? <Alert tone="error">{serverError}</Alert> : null}

          {!editId ? (
            <SegmentedControl
              options={TYPES}
              value={type}
              onChange={(v) => {
                setType(v as TransactionType);
                setCategoryId("");
              }}
              block
            />
          ) : null}

          <PriceInput label="مبلغ" unit="تومان" value={amountToman} onValueChange={setAmountToman} autoFocus />

          <Select
            label={type === "TRANSFER" ? "از حساب" : "حساب"}
            placeholder="انتخاب کنید"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            options={(accounts.data?.accounts ?? []).map((a) => ({ value: a.id, label: a.name }))}
          />

          {type === "TRANSFER" ? (
            <Select
              label="به حساب"
              placeholder="انتخاب کنید"
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              options={(accounts.data?.accounts ?? [])
                .filter((a) => a.id !== accountId)
                .map((a) => ({ value: a.id, label: a.name }))}
            />
          ) : (
            <Select
              label="دسته‌بندی"
              placeholder="بدون دسته‌بندی"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              options={relevantCategories.map((c) => ({ value: c.id, label: c.name }))}
            />
          )}

          <Input
            label="تاریخ (شمسی)"
            variant="code"
            dir="ltr"
            value={dayKey}
            onInput={(e) => setDayKey((e.target as HTMLInputElement).value)}
            hint="قالب ۱۴۰۵-۰۹-۰۱"
          />

          <div>
            <Button variant="tertiary" size="sm" onClick={() => setDetailsOpen(!detailsOpen)}>
              {detailsOpen ? "بستن جزئیات" : "جزئیات بیشتر"}
            </Button>
          </div>

          {detailsOpen ? (
            <div style={{ display: "grid", gap: 16 }}>
              <Select
                label="طرف‌حساب"
                placeholder="بدون"
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
                options={(people.data?.people ?? []).map((p) => ({ value: p.id, label: p.name }))}
              />
              <Select
                label="روش پرداخت"
                placeholder="بدون"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                options={[
                  { value: "card", label: "کارت بانکی" },
                  { value: "cash", label: "نقد" },
                  { value: "bank_transfer", label: "انتقال بانکی" },
                  { value: "card_to_card", label: "کارت‌به‌کارت" },
                  { value: "other", label: "سایر" },
                ]}
              />
              <Textarea
                label="یادداشت"
                value={note}
                onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)}
              />
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 12 }}>
            <Button variant="primary" disabled={!canSave} loading={save.isPending} onClick={() => save.mutate()}>
              {editId ? "ذخیره" : "ثبت"}
            </Button>
            <Button variant="tertiary" onClick={() => navigate(-1)}>
              انصراف
            </Button>
          </div>
        </CardBody>
      </Card>
    </Page>
  );
}

function toInitial(data?: TransactionDetailDto): Initial {
  return {
    type: (data?.type as TransactionType) ?? "EXPENSE",
    amountToman: data ? data.amountMinor / 10 : null,
    accountId: data?.accountId ?? "",
    toAccountId: data?.toAccountId ?? "",
    categoryId: data?.categoryId ?? "",
    dayKey: data?.dayKey ?? dayKeyOf(new Date()),
    note: data?.note ?? "",
    personId: data?.personId ?? "",
    paymentMethod: data?.paymentMethod ?? "",
  };
}

export function TransactionNew() {
  // Brief §5.2: the account defaults to the last used one, the date to today.
  const recent = useTransactions({ page: "1", pageSize: "1" });
  const lastAccountId = recent.data?.transactions[0]?.accountId;
  if (recent.isLoading) {
    return (
      <Page>
        <PageHeader title="ثبت تراکنش" />
        <Skeleton height={320} />
      </Page>
    );
  }
  const initial = toInitial();
  if (lastAccountId) initial.accountId = lastAccountId;
  return <Inner key={lastAccountId ?? "new"} initial={initial} />;
}

export function TransactionEdit() {
  const { id } = useParams();
  const existing = useTransaction(id ?? "none");

  if (!id || existing.isError) {
    return (
      <Page>
        <PageHeader title="تراکنش پیدا نشد" />
      </Page>
    );
  }
  if (existing.isLoading || !existing.data) {
    return (
      <Page>
        <PageHeader title="ویرایش تراکنش" />
        <Skeleton height={320} />
      </Page>
    );
  }
  return <Inner key={id} initial={toInitial(existing.data.transaction)} editId={id} />;
}
