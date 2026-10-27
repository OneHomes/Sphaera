import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { getFinanceState } from "@/lib/finance/ledgerData";
import { getUserDepartmentScope } from "@/lib/finance/departmentAccess";
import { DisputedChargesPage } from "@/components/finance/DisputedChargesPage";

export const dynamic = "force-dynamic";

export default async function FinanceDisputesRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async (authUser) => {
    const scope = await getUserDepartmentScope(authUser.id);
    const state = await getFinanceState(scope);
    const disputed = state.transactions.filter((t) => t.dispute !== null);
    return <DisputedChargesPage transactions={disputed} />;
  });
}
