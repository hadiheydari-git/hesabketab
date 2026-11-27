// Reports: income vs expenses with previous-period comparison, category
// breakdown, cash flow and account balances — custom Jalali range.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  BarList,
  Card,
  CardBody,
  EmptyState,
  Input,
  Skeleton,
  StatCard,
  StatGrid,
} from "@kashi-ui/react";
import { Page, PageHeader } from "../components/ui/Page";
import { MoneyText } from "../components/ui/MoneyText";
import { api } from "../lib/api";
import { monthEndKey, monthStartKey } from "../../shared/domain/jalali";

type Summary = {
  totals: { incomeMinor: number; expenseMinor: number; netMinor: number };
  previous: { incomeMinor: number; expenseMinor: number };
  byCategory: { categoryId: string; name: string; amountMinor: number }[];
  cashFlow: { dayKey: string; income: number; expense: number }[];
  accounts: { id: string; name: string; balanceMinor: number }[];
};

const fmt = (rial: number) => `${Math.round(rial / 10).toLocaleString("fa-IR")}`;

export function Reports() {
  const [fromDay, setFromDay] = useState(monthStartKey(new Date()));
  const [toDay, setToDay] = useState(monthEndKey(new Date()));

  const { data, isLoading, isError } = useQuery({
    queryKey: ["reports", fromDay, toDay],
    queryFn: () => api<Summary>(`/api/reports/summary?fromDay=${fromDay}&toDay=${toDay}`),
  });

  const delta = (current: number, prev: number) =>
    prev === 0 ? undefined : Math.round(((current - prev) / prev) * 100);

  return (
    <Page>
      <PageHeader title="گزارش‌ها" />

      <Card style={{ marginBlockEnd: 24 }}>
        <CardBody style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
            <Input
              label="از تاریخ"
              variant="code"
              dir="ltr"
              value={fromDay}
              onInput={(e) => setFromDay((e.target as HTMLInputElement).value)}
            />
            <Input
              label="تا تاریخ"
              variant="code"
              dir="ltr"
              value={toDay}
              onInput={(e) => setToDay((e.target as HTMLInputElement).value)}
            />
          </div>
        </CardBody>
      </Card>

      {isLoading ? (
        <Skeleton height={280} />
      ) : isError || !data ? (
        <EmptyState preset="error" title="گزارش بارگذاری نشد" description="بازهٔ تاریخ را بررسی کنید." />
      ) : (
        <div style={{ display: "grid", gap: 32 }}>
          <StatGrid>
            <StatCard
              label="درآمد"
              value={<MoneyText rial={data.totals.incomeMinor} tone="positive" />}
              change={delta(data.totals.incomeMinor, data.previous.incomeMinor)}
              caption="نسبت به دورهٔ قبل"
            />
            <StatCard
              label="هزینه"
              value={<MoneyText rial={data.totals.expenseMinor} tone="negative" />}
              change={delta(data.totals.expenseMinor, data.previous.expenseMinor)}
              caption="نسبت به دورهٔ قبل"
            />
            <StatCard label="خالص" value={<MoneyText rial={data.totals.netMinor} />} />
          </StatGrid>

          <section>
            <h2 style={{ fontSize: 18, marginBlockEnd: 12 }}>شکست هزینه‌ها به تفکیک دسته‌بندی</h2>
            {data.byCategory.length === 0 ? (
              <EmptyState preset="noData" title="در این بازه هزینه‌ای ثبت نشده است" />
            ) : (
              <BarList
                title="پرخرج‌ترین دسته‌ها"
                data={data.byCategory.slice(0, 8).map((c) => ({ label: c.name, value: c.amountMinor / 10 }))}
                format={fmt}
              />
            )}
          </section>

          <section>
            <h2 style={{ fontSize: 18, marginBlockEnd: 12 }}>جریان نقدی روزانه</h2>
            {data.cashFlow.length === 0 ? (
              <EmptyState preset="noData" title="داده‌ای برای نمایش نیست" />
            ) : (
              <BarChart
                title="درآمد و هزینه در طول دوره"
                series={[
                  {
                    name: "درآمد",
                    values: data.cashFlow.map((d) => d.income / 10),
                  },
                  {
                    name: "هزینه",
                    values: data.cashFlow.map((d) => d.expense / 10),
                  },
                ]}
                labels={data.cashFlow.map((d) => d.dayKey.slice(5))}
                format={fmt}
                height="220px"
              />
            )}
          </section>

          <section>
            <h2 style={{ fontSize: 18, marginBlockEnd: 12 }}>موجودی حساب‌ها</h2>
            {data.accounts.length === 0 ? (
              <EmptyState preset="noData" title="حسابی ثبت نشده است" />
            ) : (
              <Card>
                <CardBody style={{ padding: 0 }}>
                  {data.accounts.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "12px 24px",
                        borderBottom: "1px solid var(--k-color-border, #e2e6ec)",
                      }}
                    >
                      <span>{a.name}</span>
                      <MoneyText rial={a.balanceMinor} />
                    </div>
                  ))}
                </CardBody>
              </Card>
            )}
          </section>
        </div>
      )}
    </Page>
  );
}
