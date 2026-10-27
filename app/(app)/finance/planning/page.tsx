import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { financePlanData } from "@/lib/finance/financialPlanningData";
import { getFinanceState } from "@/lib/finance/ledgerData";
import { FinancialPlanningPage } from "@/components/finance/FinancialPlanningPage";

export const dynamic = "force-dynamic";

export default async function FinancePlanningRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async () => {
    const [{ plans, lines, targets }, financeState] = await Promise.all([
      financePlanData(),
      getFinanceState(),
    ]);

    return (
      <FinancialPlanningPage
        plans={plans}
        lines={lines}
        targets={targets}
        departments={financeState.departments}
        costHeads={financeState.managementCostHeads}
        transactions={financeState.transactions.map((t) => ({
          managementDepartment: t.managementDepartment,
          managementCostHead: t.managementCostHead,
          amount: t.amount,
          month: t.month,
          debtPeriod: t.debtPeriod,
        }))}
      />
    );
  });
}
