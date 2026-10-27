import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { getFinanceState } from "@/lib/finance/ledgerData";
import { getUserDepartmentScope } from "@/lib/finance/departmentAccess";
import { BudgetVsActualPage } from "@/components/finance/BudgetVsActualPage";

export const dynamic = "force-dynamic";

export default async function FinanceBudgetRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async (authUser) => {
    const scope = await getUserDepartmentScope(authUser.id);
    const state = await getFinanceState(scope);
    return <BudgetVsActualPage state={state} />;
  });
}
