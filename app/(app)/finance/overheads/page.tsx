import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { getFinanceState } from "@/lib/finance/ledgerData";
import { getUserDepartmentScope } from "@/lib/finance/departmentAccess";
import { listOverheadHeadRules } from "@/lib/finance/peopleOverheadsData";
import { OverheadAnalysisPage } from "@/components/finance/OverheadAnalysisPage";

export const dynamic = "force-dynamic";

export default async function FinanceOverheadsRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async (authUser) => {
    const scope = await getUserDepartmentScope(authUser.id);
    const [state, rules] = await Promise.all([getFinanceState(scope), listOverheadHeadRules()]);
    return (
      <OverheadAnalysisPage
        costHeads={state.managementCostHeads}
        departments={state.departments}
        transactions={state.transactions}
        rules={rules}
        canEdit={authUser.canAccessFinancePayroll}
      />
    );
  });
}
