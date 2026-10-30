import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import {
  listRecentMerchantBatches,
  supplierClusterSuggestions,
  merchantCatalog,
  buildMerchantReviewExportRows,
  listManagementCostHeadNames,
} from "@/lib/finance/merchantReconcileData";
import { MerchantReconciliationPage } from "@/components/finance/MerchantReconciliationPage";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";
import { DepartmentLimitedNotice } from "@/components/finance/DepartmentLimitedNotice";

export const dynamic = "force-dynamic";

export default async function FinanceMerchantRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async (authUser) => {
    if (await isDepartmentScoped(authUser.id)) return <DepartmentLimitedNotice />;
    const [batches, suggestions, catalog, allRows, costHeadOptions] = await Promise.all([
      listRecentMerchantBatches(),
      supplierClusterSuggestions(),
      merchantCatalog(),
      buildMerchantReviewExportRows({}),
      listManagementCostHeadNames(),
    ]);

    // "Reviewed payments" pill: payments that already have a proposed or
    // approved subscription/product identification on file, across all
    // years — the same per-payment review data the Excel round-trip
    // reads/writes (FinanceMerchantReview), not a guess.
    const reviewedCount = allRows.filter((r) => Boolean(r.product)).length;

    // The merchant/cost-head picker, the supplier-name "smart" suggestions
    // panel and the Service Provider Groups panel all need the real
    // catalog/suggestion shapes (provider ids + aliases, suggestion
    // reasons/confidence/alias counts) rather than a flattened name list,
    // so both are passed through as-is.
    return (
      <MerchantReconciliationPage
        reviewedCount={reviewedCount}
        totalPaymentCount={allRows.length}
        recentBatchCount={batches.length}
        catalog={catalog}
        costHeadOptions={costHeadOptions}
        supplierSuggestions={suggestions}
      />
    );
  });
}
