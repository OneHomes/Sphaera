import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { listOverheadHeadRules } from "@/lib/finance/peopleOverheadsData";
import { OverviewView } from "@/components/finance/FinanceViews";

export const dynamic = "force-dynamic";

export default async function FinanceOverviewRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async () => {
    const overheadRules = await listOverheadHeadRules();
    return <OverviewView overheadRules={overheadRules} />;
  });
}
