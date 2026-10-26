import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { getFinanceState } from "@/lib/finance/ledgerData";
import { OrganiseCostsPage } from "@/components/finance/OrganiseCostsPage";

export const dynamic = "force-dynamic";

export default async function FinanceOrganiseRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async () => {
    const state = await getFinanceState();
    return (
      <OrganiseCostsPage
        initialDepartments={state.departments}
        initialCostHeads={state.managementCostHeads}
      />
    );
  });
}
