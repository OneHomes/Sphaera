import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { ExplorerView } from "@/components/finance/FinanceViews";

export const dynamic = "force-dynamic";

export default async function FinanceExplorerRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async () => {
    return <ExplorerView />;
  });
}
