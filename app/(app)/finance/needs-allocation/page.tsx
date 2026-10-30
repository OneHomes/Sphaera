import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { NeedsAllocationView } from "@/components/finance/FinanceViews";

export const dynamic = "force-dynamic";

export default async function FinanceNeedsAllocationRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async () => {
    return <NeedsAllocationView />;
  });
}
