import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { getFinanceState } from "@/lib/finance/ledgerData";
import { listOverheadHeadRules } from "@/lib/finance/peopleOverheadsData";
import { OverviewPage } from "@/components/finance/OverviewPage";

export const dynamic = "force-dynamic";

export default async function FinanceOverviewRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async () => {
    const [state, overheadRules] = await Promise.all([getFinanceState(), listOverheadHeadRules()]);
    return <OverviewPage state={state} overheadRules={overheadRules} />;
  });
}
