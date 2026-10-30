import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { listErpSources, getErpFundSummary } from "@/lib/finance/erpRegistryData";
import { ErpConnectionsPage } from "@/components/finance/ErpConnectionsPage";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";
import { DepartmentLimitedNotice } from "@/components/finance/DepartmentLimitedNotice";

export const dynamic = "force-dynamic";

export default async function FinanceErpRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async (authUser) => {
    if (await isDepartmentScoped(authUser.id)) return <DepartmentLimitedNotice />;
    const [sources, fundSummary] = await Promise.all([listErpSources(), getErpFundSummary()]);
    return <ErpConnectionsPage sources={sources} fundSummary={fundSummary} />;
  });
}
