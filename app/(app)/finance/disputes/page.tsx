import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { DisputesView } from "@/components/finance/FinanceViews";

export const dynamic = "force-dynamic";

export default async function FinanceDisputesRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async () => {
    return <DisputesView />;
  });
}
