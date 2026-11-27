// Dashboard: one honest screen — real totals, real empty states, quick
// add as the single primary action (brief §4.5: ≤5 blocks above fold).
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Button, EmptyState, Skeleton, StatCard, StatGrid } from "@kashi-ui/react";
import { api } from "../lib/api";
import { MoneyText } from "../components/ui/MoneyText";
import { Page, PageHeader } from "../components/ui/Page";

type Summary = {
  counts: { accounts: number; transactions: number; budgets: number; debts: number };
  totalBalanceMinor: number;
};

export function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<Summary>("/api/dashboard"),
  });

  if (isLoading) {
    return (
      <Page>
        <PageHeader title="خانه" />
        <StatGrid>
          <Skeleton height={120} />
          <Skeleton height={120} />
        </StatGrid>
      </Page>
    );
  }

  if (isError || !data) {
    return (
      <Page>
        <PageHeader title="خانه" />
        <EmptyState
          title="داشبورد بارگذاری نشد"
          description="اتصال اینترنت را بررسی کنید و دوباره تلاش کنید."
          actions={<Button onClick={() => navigate(0)}>تلاش دوباره</Button>}
        />
      </Page>
    );
  }

  const empty = data.counts.transactions === 0 || data.counts.accounts === 0;

  return (
    <Page>
      <PageHeader
        title="خانه"
        action={
          <Button variant="primary" onClick={() => navigate("/transactions/new")}>
            ثبت تراکنش
          </Button>
        }
      />

      {empty ? (
        <EmptyState
          title="هنوز چیزی ثبت نکرده‌اید"
          description={
            data.counts.accounts === 0
              ? "برای شروع، یک حساب بسازید؛ مثلاً حساب بانکی یا پول نقد."
              : "اولین درآمد یا هزینهٔ خود را ثبت کنید تا داشبورد زنده شود."
          }
          actions={
            data.counts.accounts === 0 ? (
              <Button variant="primary" onClick={() => navigate("/accounts/new")}>
                افزودن حساب
              </Button>
            ) : (
              <Button variant="primary" onClick={() => navigate("/transactions/new")}>
                ثبت اولین تراکنش
              </Button>
            )
          }
        />
      ) : (
        <StatGrid>
          <StatCard label="موجودی کل" value={<MoneyText rial={data.totalBalanceMinor} size="lg" />} />
          <StatCard label="تراکنش‌ها" value={data.counts.transactions} caption="در کل دوره" />
          <StatCard label="بودجه‌های فعال" value={data.counts.budgets} />
          <StatCard label="بدهی و طلب" value={data.counts.debts} />
        </StatGrid>
      )}
    </Page>
  );
}
