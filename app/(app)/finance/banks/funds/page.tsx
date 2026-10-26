import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { getTreasuryState } from "@/lib/finance/treasuryData";
import { TreasuryFundsPage } from "@/components/finance/TreasuryFundsPage";

export const dynamic = "force-dynamic";

export default async function FinanceTreasuryFundsRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async () => {
    const state = await getTreasuryState();
    return <TreasuryFundsPage state={state} />;
  });
}
