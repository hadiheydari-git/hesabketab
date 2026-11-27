// Debts & receivables (بدهی و طلب): list with remaining + overdue badges,
// create dialog with inline person creation, repayment dialog, detail view.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  CardBody,
  Dialog,
  EmptyState,
  Input,
  PriceInput,
  SegmentedControl,
  Select,
  Skeleton,
  toast,
} from "@kashi-ui/react";
import { Page, PageHeader } from "../components/ui/Page";
import { MoneyText } from "../components/ui/MoneyText";
import { useAccounts, useDebts, usePeople, type DebtDto } from "../lib/queries";
import { tomanToRial } from "../../shared/domain/money";
import { dayKeyOf } from "../../shared/domain/jalali";

function DebtDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const people = usePeople();
  const accounts = useAccounts();
  const [direction, setDirection] = useState("borrowed");
  const [personId, setPersonId] = useState("");
  const [newPerson, setNewPerson] = useState("");
  const [amountToman, setAmountToman] = useState<number | null>(null);
  const [accountId, setAccountId] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    try {
      let pid = personId;
      if (newPerson.trim()) {
        const res = await postJson<{ person: { id: string } }>("/api/people", { name: newPerson.trim() });
        pid = res.person.id;
      }
      if (!pid) throw new Error("طرف‌حساب را انتخاب یا نامش را بنویسید.");
      await postJson("/api/debts", {
        direction,
        personId: pid,
        principalMinor: tomanToRial(amountToman ?? 0),
        accountId: accountId || null,
        dueDayKey: dueDay || null,
      });
      await Promise.all(["debts", "accounts", "dashboard", "people"].map((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      ));
      toast.success("ثبت شد");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ثبت انجام نشد.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="بدهی یا طلب جدید"
      footer={
        <>
          <Button variant="tertiary" onClick={onClose}>
            انصراف
          </Button>
          <Button variant="primary" onClick={save} disabled={(amountToman ?? 0) <= 0}>
            ثبت
          </Button>
        </>
      }
    >
      <div style={{ display: "grid", gap: 16 }}>
        {error ? <Badge tone="error">{error}</Badge> : null}
        <SegmentedControl
          options={[
            { value: "borrowed", label: "بدهی من" },
            { value: "lent", label: "طلب من" },
          ]}
          value={direction}
          onChange={setDirection}
          block
        />
        <PriceInput label="مبلغ" unit="تومان" value={amountToman} onValueChange={setAmountToman} autoFocus />
        <Select
          label="طرف‌حساب"
          placeholder="انتخاب کنید یا نام تازه بنویسید"
          value={personId}
          onChange={(e) => setPersonId(e.target.value)}
          options={(people.data?.people ?? []).map((p) => ({ value: p.id, label: p.name }))}
        />
        <Input label="طرف‌حساب تازه" value={newPerson} onInput={(e) => setNewPerson((e.target as HTMLInputElement).value)} hint="با ثبت، ساخته می‌شود" />
        <Select
          label="حساب مرتبط (اختیاری)"
          placeholder="بدون جابه‌جایی پول"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          options={(accounts.data?.accounts ?? []).map((a) => ({ value: a.id, label: a.name }))}
          hint="با انتخاب حساب، مبلغ در همان روز به موجودی اضافه یا از آن کم می‌شود"
        />
        <Input
          label="سررسید (شمسی، اختیاری)"
          variant="code"
          dir="ltr"
          value={dueDay}
          onInput={(e) => setDueDay((e.target as HTMLInputElement).value)}
          hint="مثل ۱۴۰۵/۱۰/۰۱"
        />
      </div>
    </Dialog>
  );
}

function RepaymentDialog({ debt, onClose }: { debt: DebtDto | null; onClose: () => void }) {
  const qc = useQueryClient();
  const accounts = useAccounts();
  const [amountToman, setAmountToman] = useState<number | null>(null);
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    try {
      await postJson(`/api/debts/${debt!.id}/repayments`, {
        amountMinor: tomanToRial(amountToman ?? 0),
        accountId,
        dayKey: dayKeyOf(new Date()),
      });
      await Promise.all(["debts", "accounts", "dashboard", "budgets"].map((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      ));
      toast.success("بازپرداخت ثبت شد");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ثبت انجام نشد.");
    }
  };

  return (
    <Dialog
      open={debt !== null}
      onOpenChange={(o) => !o && onClose()}
      title="ثبت بازپرداخت"
      footer={
        <>
          <Button variant="tertiary" onClick={onClose}>
            انصراف
          </Button>
          <Button variant="primary" onClick={save} disabled={(amountToman ?? 0) <= 0 || !accountId}>
            ثبت
          </Button>
        </>
      }
    >
      <div style={{ display: "grid", gap: 16 }}>
        {error ? <Badge tone="error">{error}</Badge> : null}
        {debt ? (
          <p style={{ margin: 0 }}>
            مانده: <MoneyText rial={debt.remainingMinor} />
          </p>
        ) : null}
        <PriceInput label="مبلغ" unit="تومان" value={amountToman} onValueChange={setAmountToman} autoFocus />
        <Select
          label="حساب"
          placeholder="انتخاب کنید"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          options={(accounts.data?.accounts ?? []).map((a) => ({ value: a.id, label: a.name }))}
        />
      </div>
    </Dialog>
  );
}

export function Debts() {
  const { data, isLoading } = useDebts();
  const [createOpen, setCreateOpen] = useState(false);
  const [repayTarget, setRepayTarget] = useState<DebtDto | null>(null);
  const qc = useQueryClient();

  const rows = data?.debts ?? [];
  const borrowed = rows.filter((d) => d.direction === "borrowed" && !d.settled);
  const lent = rows.filter((d) => d.direction === "lent" && !d.settled);

  const remove = async (id: string) => {
    await fetch(`/api/debts/${id}`, { method: "DELETE", credentials: "same-origin" });
    await qc.invalidateQueries({ queryKey: ["debts"] });
  };

  const Row = ({ d }: { d: DebtDto }) => (
    <Card>
      <CardBody style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, display: "grid", gap: 4 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Badge tone={d.direction === "borrowed" ? "error" : "success"}>
              {d.direction === "borrowed" ? "بدهی من" : "طلب من"}
            </Badge>
            {d.overdue ? <Badge tone="error">گذشته از سررسید</Badge> : null}
            {d.settled ? <Badge tone="success">تسویه شده</Badge> : null}
          </div>
          <span style={{ fontSize: 13, color: "var(--k-color-fg-muted, #5b6676)" }}>
            {d.dueDayKey ? `سررسید ${d.dueDayKey}` : "بدون سررسید"}
          </span>
        </div>
        <div style={{ textAlign: "end" }}>
          <div style={{ fontSize: 13 }}>
            مانده: <MoneyText rial={d.remainingMinor} />
          </div>
          {!d.settled ? (
            <Button size="sm" variant="tertiary" onClick={() => setRepayTarget(d)}>
              بازپرداخت
            </Button>
          ) : null}
          <Button size="sm" variant="tertiary" onClick={() => remove(d.id)}>
            حذف
          </Button>
        </div>
      </CardBody>
    </Card>
  );

  return (
    <Page>
      <PageHeader
        title="بدهی و طلب"
        action={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            افزودن
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton height={200} />
      ) : rows.length === 0 ? (
        <EmptyState
          preset="noData"
          title="بدهی یا طلبی ثبت نشده است"
          description="قرض‌ها و طلب‌های خود را ثبت کنید تا مانده و سررسیدشان را ببینید."
          actions={
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              افزودن
            </Button>
          }
        />
      ) : (
        <div style={{ display: "grid", gap: 32 }}>
          <section style={{ display: "grid", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>بدهی من ({borrowed.length})</h2>
            {borrowed.length === 0 ? <p style={{ margin: 0, color: "var(--k-color-fg-muted, #5b6676)" }}>بدهی بازی نیست.</p> : borrowed.map((d) => <Row key={d.id} d={d} />)}
          </section>
          <section style={{ display: "grid", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>طلب من ({lent.length})</h2>
            {lent.length === 0 ? <p style={{ margin: 0, color: "var(--k-color-fg-muted, #5b6676)" }}>طلبی بازی نیست.</p> : lent.map((d) => <Row key={d.id} d={d} />)}
          </section>
        </div>
      )}

      <DebtDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      <RepaymentDialog debt={repayTarget} onClose={() => setRepayTarget(null)} />
    </Page>
  );
}

function postJson<T>(path: string, data: unknown): Promise<T> {
  return fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(data),
  }).then(async (res) => {
    const body = (await res.json().catch(() => ({}))) as T & { error?: { message: string } };
    if (!res.ok) throw new Error(body.error?.message ?? "خطا");
    return body;
  });
}
