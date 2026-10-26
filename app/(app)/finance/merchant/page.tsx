import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import {
  listRecentMerchantBatches,
  supplierClusterSuggestions,
  merchantCatalog,
} from "@/lib/finance/merchantReconcileData";
import { MerchantReconciliationPage } from "@/components/finance/MerchantReconciliationPage";

export const dynamic = "force-dynamic";

export default async function FinanceMerchantRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async () => {
    const [batches, suggestions, catalog] = await Promise.all([
      listRecentMerchantBatches(),
      supplierClusterSuggestions(),
      merchantCatalog(),
    ]);
    return <MerchantReconciliationPage batches={batches} suggestions={suggestions} catalog={catalog} />;
  });
}
