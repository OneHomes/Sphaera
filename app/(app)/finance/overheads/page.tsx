import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { getFinanceState } from "@/lib/finance/ledgerData";
import { listOverheadHeadRules } from "@/lib/finance/peopleOverheadsData";
import { OverheadAnalysisPage } from "@/components/finance/OverheadAnalysisPage";

export const dynamic = "force-dynamic";

export default async function FinanceOverheadsRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async (authUser) => {
    const [state, rules] = await Promise.all([getFinanceState(), listOverheadHeadRules()]);
    return (
      <OverheadAnalysisPage
        costHeads={state.managementCostHeads}
        transactions={state.transactions.map((t) => ({
          id: t.id,
          date: t.date,
          month: t.month,
          description: t.description,
          amount: t.amount,
          managementDepartment: t.managementDepartment,
          managementCostHead: t.managementCostHead,
          overheadOverride: t.overheadOverride,
        }))}
        rules={rules}
        canEdit={authUser.canAccessFinancePayroll}
      />
    );
  });
}
