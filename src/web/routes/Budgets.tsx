// Budgets: monthly budgets per category set with progress bars (amber at
// 80%, red above 100%) and a create dialog with a Jalali month picker.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  CardBody,
  Dialog,
  EmptyState,
  MonthPicker,
  PriceInput,
  Progress,
  Select,
  Skeleton,
  toast,
} from "@kashi-ui/react";
import { Page, PageHeader } from "../components/ui/Page";
import { MoneyText } from "../components/ui/MoneyText";
import { useBudgets, useCategories } from "../lib/queries";
import { tomanToRial } from "../../shared/domain/money";
import { currentMonthKey } from "../../shared/domain/jalali";
import type { JalaliMonth } from "@kashi-ui/react";

function BudgetDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const categories = useCategories();
  const [month, setMonth] = useState<JalaliMonth | null>(null);
  const [limitToman, setLimitToman] = useState<number | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    try {
      const m = month ?? { year: Number(currentMonthKey(new Date()).split("-")[0]), month: Number(currentMonthKey(new Date()).split("-")[1]) };
      await fetch("/api/budgets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          monthKey: `${m.year}-${String(m.month).padStart(2, "0")}`,
          limitMinor: tomanToRial(limitToman ?? 0),
          categoryIds: selected,
        }),
      }).then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: { message: string } };
          throw new Error(body.error?.message ?? "ثبت بودجه انجام نشد.");
        }
      });
      await qc.invalidateQueries({ queryKey: ["budgets"] });
      toast.success("بودجه ثبت شد");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ثبت بودجه انجام نشد.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title="بودجهٔ ماهانه" size="lg">
      <div style={{ display: "grid", gap: 16 }}>
        {error ? <Badge tone="error">{error}</Badge> : null}
        <MonthPicker value={month} onChange={setMonth} />
        <PriceInput label="سقف ماهانه" unit="تومان" value={limitToman} onValueChange={setLimitToman} />
        <Select
          label="دسته‌بندی‌ها"
          placeholder="انتخاب کنید (چندتایی)"
          native
          multiple
          value={selected}
          onChange={(e) => setSelected([...(e.target as HTMLSelectElement).selectedOptions].map((o) => o.value))}
          options={(categories.data?.categories ?? [])
            .filter((c) => c.kind === "expense")
            .map((c) => ({ value: c.id, label: c.name }))}
          hint="با Ctrl یا کشیدن، چند دسته را انتخاب کنید"
        />
        <Button variant="primary" onClick={save} disabled={(limitToman ?? 0) <= 0 || selected.length === 0}>
          ثبت بودجه
        </Button>
      </div>
    </Dialog>
  );
}

export function Budgets() {
  const { data, isLoading } = useBudgets();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const remove = async (id: string) => {
    await fetch(`/api/budgets/${id}`, { method: "DELETE", credentials: "same-origin" });
    await qc.invalidateQueries({ queryKey: ["budgets"] });
  };

  const rows = data?.budgets ?? [];

  return (
    <Page>
      <PageHeader
        title="بودجه‌ها"
        action={
          <Button variant="primary" onClick={() => setOpen(true)}>
            بودجهٔ جدید
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton height={200} />
      ) : rows.length === 0 ? (
        <EmptyState
          preset="noData"
          title="بودجه‌ای نساخته‌اید"
          description="برای دسته‌بندی‌های خود سقف ماهانه بگذارید تا خرج‌ها را مهار کنید."
          actions={
            <Button variant="primary" onClick={() => setOpen(true)}>
              بودجهٔ جدید
            </Button>
          }
        />
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {rows.map((b) => (
            <Card key={b.id}>
              <CardBody style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong>{b.monthKey.replace("-", " / ")}</strong>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Badge tone={b.state === "exceeded" ? "error" : b.state === "warning" ? "warning" : "success"}>
                      {Math.round(b.percent)}٪ مصرف شده
                    </Badge>
                    <Button size="sm" variant="tertiary" onClick={() => remove(b.id)}>
                      حذف
                    </Button>
                  </div>
                </div>
                <Progress
                  value={b.actualMinor}
                  max={b.limitMinor}
                  tone={b.state === "exceeded" ? "error" : b.state === "warning" ? "warning" : "brand"}
                  showValue={false}
                  aria-label={`مصرف بودجه ${b.monthKey}`}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, flexWrap: "wrap", gap: 4 }}>
                  <span>
                    خرج شده: <MoneyText rial={b.actualMinor} />
                  </span>
                  <span>
                    سقف: <MoneyText rial={b.limitMinor} />
                  </span>
                  <span>
                    باقی‌مانده: <MoneyText rial={b.remainingMinor} tone={b.remainingMinor < 0 ? "negative" : "neutral"} />
                  </span>
                </div>
                <span style={{ fontSize: 13, color: "var(--k-color-fg-muted, #5b6676)" }}>
                  دسته‌ها: {b.categories.join("، ")}
                </span>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <BudgetDialog open={open} onClose={() => setOpen(false)} />
    </Page>
  );
}
