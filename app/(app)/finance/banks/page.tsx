import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { getTreasuryStateWithForecast } from "@/lib/finance/treasuryForecast";
import { BanksPage } from "@/components/finance/BanksPage";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";
import { DepartmentLimitedNotice } from "@/components/finance/DepartmentLimitedNotice";

export const dynamic = "force-dynamic";

export default async function FinanceBanksRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async (authUser) => {
    if (await isDepartmentScoped(authUser.id)) return <DepartmentLimitedNotice />;
    const state = await getTreasuryStateWithForecast(Boolean(authUser.canAccessFinancePayroll));
    return <BanksPage state={state} />;
  });
}
