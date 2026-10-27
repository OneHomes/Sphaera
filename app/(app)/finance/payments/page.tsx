import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { getFinanceState } from "@/lib/finance/ledgerData";
import { getUserDepartmentScope } from "@/lib/finance/departmentAccess";
import { AllPaymentsPage } from "@/components/finance/AllPaymentsPage";

export const dynamic = "force-dynamic";

export default async function FinancePaymentsRoute({
  searchParams,
}: {
  searchParams: { department?: string; month?: string; mode?: string; costHead?: string; description?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async (authUser) => {
    const scope = await getUserDepartmentScope(authUser.id);
    const state = await getFinanceState(scope);
    return (
      <AllPaymentsPage
        transactions={state.transactions}
        departments={state.departments}
        managementCostHeads={state.managementCostHeads}
        costHeads={state.costHeads}
        initialDepartmentFilter={searchParams.department ?? null}
        initialMonthFilter={searchParams.month ?? null}
        initialMode={searchParams.mode ?? null}
        initialCostHeadFilter={searchParams.costHead ?? null}
        initialDescriptionFilter={searchParams.description ?? null}
      />
    );
  });
}
