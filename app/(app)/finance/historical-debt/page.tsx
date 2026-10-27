import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { getFinanceState } from "@/lib/finance/ledgerData";
import { getUserDepartmentScope } from "@/lib/finance/departmentAccess";
import { HistoricalDebtPage } from "@/components/finance/HistoricalDebtPage";

export const dynamic = "force-dynamic";

export default async function FinanceHistoricalDebtRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async (authUser) => {
    const scope = await getUserDepartmentScope(authUser.id);
    const state = await getFinanceState(scope);
    return <HistoricalDebtPage state={state} />;
  });
}
