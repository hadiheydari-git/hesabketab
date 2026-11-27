// People (طرف‌حساب‌ها): list with inline create; per-person net position.
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
  Skeleton,
  toast,
} from "@kashi-ui/react";
import { Page, PageHeader } from "../components/ui/Page";
import { MoneyText } from "../components/ui/MoneyText";
import { useDebts, usePeople, type PersonDto } from "../lib/queries";

function PersonDialog({
  open,
  onClose,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  existing?: PersonDto;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(existing?.name ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    const res = await fetch(existing ? `/api/people/${existing.id}` : "/api/people", {
      method: existing ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ name, phone: phone || null }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: { message: string } };
    if (!res.ok) {
      setError(body.error?.message ?? "ذخیره انجام نشد.");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["people"] });
    toast.success("ذخیره شد");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={existing ? "ویرایش طرف‌حساب" : "افزودن طرف‌حساب"}
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
        <Input label="نام" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        <Input
          label="تلفن (اختیاری)"
          variant="code"
          dir="ltr"
          value={phone}
          onInput={(e) => setPhone((e.target as HTMLInputElement).value)}
        />
      </div>
    </Dialog>
  );
}

export function People() {
  const people = usePeople();
  const debts = useDebts();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PersonDto | undefined>(undefined);
  const qc = useQueryClient();

  const rows = people.data?.people ?? [];

  const remove = async (id: string) => {
    await fetch(`/api/people/${id}`, { method: "DELETE", credentials: "same-origin" });
    await Promise.all(["people", "debts"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  };

  const netFor = (personId: string) => {
    const list = (debts.data?.debts ?? []).filter((d) => d.personId === personId && !d.settled);
    const lent = list.filter((d) => d.direction === "lent").reduce((s, d) => s + d.remainingMinor, 0);
    const borrowed = list.filter((d) => d.direction === "borrowed").reduce((s, d) => s + d.remainingMinor, 0);
    return { lent, borrowed, net: lent - borrowed };
  };

  return (
    <Page>
      <PageHeader
        title="طرف‌حساب‌ها"
        action={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
          >
            افزودن
          </Button>
        }
      />

      {people.isLoading ? (
        <Skeleton height={200} />
      ) : rows.length === 0 ? (
        <EmptyState
          preset="noData"
          title="طرف‌حسابی ثبت نشده است"
          description="در بدهی و طلب‌ها می‌توانید طرف‌حساب را همان‌جا بسازید."
          actions={
            <Button variant="primary" onClick={() => setOpen(true)}>
              افزودن
            </Button>
          }
        />
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((p) => {
            const net = netFor(p.id);
            return (
              <Card key={p.id}>
                <CardBody style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1 }}>
                    <strong>{p.name}</strong>
                    {p.phone ? (
                      <span dir="ltr" style={{ marginInlineStart: 8, fontSize: 13 }}>
                        {p.phone}
                      </span>
                    ) : null}
                  </div>
                  {net.net !== 0 ? (
                    <Badge tone={net.net > 0 ? "success" : "error"}>
                      {net.net > 0 ? "طلب من" : "بدهی من"}: <MoneyText rial={Math.abs(net.net)} />
                    </Badge>
                  ) : (
                    <Badge>تسویه</Badge>
                  )}
                  <Button
                    size="sm"
                    variant="tertiary"
                    onClick={() => {
                      setEditing(p);
                      setOpen(true);
                    }}
                  >
                    ویرایش
                  </Button>
                  <Button size="sm" variant="tertiary" onClick={() => remove(p.id)}>
                    حذف
                  </Button>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <PersonDialog open={open} onClose={() => setOpen(false)} existing={editing} />
    </Page>
  );
}
