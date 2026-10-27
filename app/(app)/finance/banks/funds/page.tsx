import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { getTreasuryForecast, getTreasuryStateWithForecast } from "@/lib/finance/treasuryForecast";
import { TreasuryFundsPage } from "@/components/finance/TreasuryFundsPage";

export const dynamic = "force-dynamic";

export default async function FinanceTreasuryFundsRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async (authUser) => {
    const includePayroll = Boolean(authUser.canAccessFinancePayroll);
    const [state, forecast] = await Promise.all([
      getTreasuryStateWithForecast(includePayroll),
      getTreasuryForecast(3, includePayroll),
    ]);
    return <TreasuryFundsPage state={state} initialForecast={forecast} />;
  });
}
