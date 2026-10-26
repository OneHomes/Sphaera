import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import {
  listErpSources,
  getErpStatus,
  getErpFundSummary,
  getLatestErpBankBalances,
} from "@/lib/finance/erpRegistryData";
import { ErpConnectionsPage } from "@/components/finance/ErpConnectionsPage";

export const dynamic = "force-dynamic";

export default async function FinanceErpRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async () => {
    const [sources, status, fundSummary, bankBalances] = await Promise.all([
      listErpSources(),
      getErpStatus(),
      getErpFundSummary(),
      getLatestErpBankBalances(),
    ]);
    return (
      <ErpConnectionsPage sources={sources} status={status} fundSummary={fundSummary} bankBalances={bankBalances} />
    );
  });
}
