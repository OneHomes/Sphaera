import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { getFinanceState } from "@/lib/finance/ledgerData";
import { HistoricalDebtPage } from "@/components/finance/HistoricalDebtPage";

export const dynamic = "force-dynamic";

export default async function FinanceHistoricalDebtRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async () => {
    const state = await getFinanceState();
    const debtTransactions = state.transactions
      .filter((t) => t.debtPeriod !== "current")
      .map((t) => ({
        id: t.id,
        date: t.date.toISOString(),
        description: t.description,
        managementDepartment: t.managementDepartment,
        managementCostHead: t.managementCostHead,
        amount: t.amount,
        debtPeriod: t.debtPeriod,
        reviewed: t.reviewed,
      }));
    return <HistoricalDebtPage transactions={debtTransactions} />;
  });
}
