// Accounts: list with live balances, create dialog, archive/unarchive,
// and a per-account detail page listing its transactions.
import { useState } from "react";
import { Link, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  CardBody,
  Dialog,
  EmptyState,
  PriceInput,
  Select,
  Skeleton,
} from "@kashi-ui/react";
import { Page, PageHeader } from "../components/ui/Page";
import { MoneyText } from "../components/ui/MoneyText";
import { useAccounts, useTransactions, type AccountDto } from "../lib/queries";
import { tomanToRial } from "../../shared/domain/money";
import { formatJalali } from "@kashi-ui/persian";

const TYPE_LABELS: Record<string, string> = {
  bank: "بانک",
  cash: "نقد",
  wallet: "کیف پول",
  savings: "پس‌انداز",
  credit: "اعتباری",
  custom: "سایر",
};

function AccountDialog({
  open,
  onClose,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  existing?: AccountDto;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(existing?.name ?? "");
  const [type, setType] = useState(existing?.type ?? "bank");
  const [openingToman, setOpeningToman] = useState<number | null>(
    existing ? existing.openingBalanceMinor / 10 : 0,
  );
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const body = {
      name,
      type,
      openingBalanceMinor: tomanToRial(openingToman ?? 0),
    };
    const res = await fetch(existing ? `/api/accounts/${existing.id}` : "/api/accounts", {
      method: existing ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: { message: string } };
    if (!res.ok) {
      setError(data.error?.message ?? "ذخیره انجام نشد.");
      return;
    }
    await Promise.all(["accounts", "dashboard"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={existing ? "ویرایش حساب" : "افزودن حساب"}
      footer={
        <>
          <Button variant="tertiary" onClick={onClose}>
            انصراف
          </Button>
          <Button variant="primary" onClick={save} disabled={!name.trim()}>
            ذخیره
          </Button>
        </>
      }
    >
      <div style={{ display: "grid", gap: 16 }}>
        {error ? <Badge tone="error">{error}</Badge> : null}
        <Select
          label="نوع حساب"
          value={type}
          onChange={(e) => setType(e.target.value)}
          options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <input
          aria-label="نام حساب"
          placeholder="مثلاً بانک ملت یا پول نقد"
          value={name}
          onInput={(e) => setName((e.target as HTMLInputElement).value)}
          style={{
            padding: "10px 12px",
            border: "1px solid var(--k-color-border, #e2e6ec)",
            borderRadius: 8,
            background: "var(--k-color-surface, #fff)",
            font: "inherit",
          }}
        />
        <PriceInput label="موجودی اولیه" unit="تومان" value={openingToman} onValueChange={setOpeningToman} />
      </div>
    </Dialog>
  );
}

export function Accounts() {
  const { data, isLoading } = useAccounts(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AccountDto | undefined>(undefined);
  const qc = useQueryClient();

  const archive = async (id: string, archived: boolean) => {
    await fetch(`/api/accounts/${id}/archive`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ archived }),
    });
    await qc.invalidateQueries({ queryKey: ["accounts"] });
    await qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const rows = data?.accounts ?? [];

  return (
    <Page>
      <PageHeader
        title="حساب‌ها"
        action={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(undefined);
              setDialogOpen(true);
            }}
          >
            افزودن حساب
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton height={200} />
      ) : rows.length === 0 ? (
        <EmptyState
          preset="noData"
          title="هنوز حسابی نساخته‌اید"
          description="یک حساب بانکی یا پول نقد بسازید تا ثبت تراکنش شروع شود."
          actions={
            <Button variant="primary" onClick={() => setDialogOpen(true)}>
              افزودن حساب
            </Button>
          }
        />
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((a) => (
            <Card key={a.id}>
              <CardBody
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  opacity: a.archivedAt ? 0.6 : 1,
                }}
              >
                <div style={{ flex: 1, display: "grid", gap: 2 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Link to={`/accounts/${a.id}`} style={{ fontWeight: 600, textDecoration: "none" }}>
                      {a.name}
                    </Link>
                    <Badge>{TYPE_LABELS[a.type] ?? a.type}</Badge>
                    {a.archivedAt ? <Badge tone="warning">بایگانی</Badge> : null}
                  </div>
                </div>
                <MoneyText rial={a.balanceMinor} size="md" />
                <Button
                  size="sm"
                  variant="tertiary"
                  onClick={() => {
                    setEditing(a);
                    setDialogOpen(true);
                  }}
                >
                  ویرایش
                </Button>
                <Button size="sm" variant="tertiary" onClick={() => archive(a.id, !a.archivedAt)}>
                  {a.archivedAt ? "خروج از بایگانی" : "بایگانی"}
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <AccountDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        existing={editing}
      />
    </Page>
  );
}

export function AccountDetail() {
  const { id } = useParams();
  const accounts = useAccounts(true);
  const tx = useTransactions(id ? { accountId: id } : {});
  const account = accounts.data?.accounts.find((a) => a.id === id);

  if (!accounts.isLoading && !account) {
    return (
      <Page>
        <PageHeader title="حساب پیدا نشد" />
        <EmptyState preset="noResults" title="حساب پیدا نشد" actions={<Button as={Link} href="/accounts">بازگشت</Button>} />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title={account?.name ?? "حساب"} />
      {account ? (
        <Card style={{ marginBlockEnd: 24 }}>
          <CardBody style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--k-color-fg-muted, #5b6676)" }}>موجودی فعلی</span>
            <MoneyText rial={account.balanceMinor} size="lg" />
          </CardBody>
        </Card>
      ) : null}

      {tx.isLoading ? (
        <Skeleton height={200} />
      ) : (tx.data?.transactions ?? []).length === 0 ? (
        <EmptyState preset="noData" title="این حساب تراکنشی ندارد" />
      ) : (
        <Card>
          <CardBody style={{ padding: 0 }}>
            {tx.data!.transactions.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 24px",
                  borderBottom: "1px solid var(--k-color-border, #e2e6ec)",
                }}
              >
                <span style={{ fontSize: 13 }}>
                  {formatJalali(new Date(t.occurredAt))}
                </span>
                <MoneyText
                  rial={t.amountMinor}
                  tone={t.type === "INCOME" ? "positive" : t.type === "EXPENSE" ? "negative" : "neutral"}
                />
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </Page>
  );
}
