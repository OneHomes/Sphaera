import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { getFinanceState } from "@/lib/finance/ledgerData";
import { SpendingExplorerPage } from "@/components/finance/SpendingExplorerPage";

export const dynamic = "force-dynamic";

export default async function FinanceExplorerRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async () => {
    const state = await getFinanceState();
    return <SpendingExplorerPage state={state} />;
  });
}
