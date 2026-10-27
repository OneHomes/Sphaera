import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { getFinanceState } from "@/lib/finance/ledgerData";
import { NeedsAllocationPage } from "@/components/finance/NeedsAllocationPage";

export const dynamic = "force-dynamic";

export default async function FinanceNeedsAllocationRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async () => {
    const state = await getFinanceState();
    return (
      <NeedsAllocationPage
        transactions={state.transactions}
        departments={state.departments}
        managementCostHeads={state.managementCostHeads}
        costHeads={state.costHeads}
      />
    );
  });
}
