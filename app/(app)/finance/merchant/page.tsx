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

export const dynamic = "force-dynamic";

export default async function FinanceMerchantRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async () => {
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

    // Merchant-name picker options: known reporting-supplier providers,
    // raw (ungrouped) source descriptions, and pending cluster-suggestion
    // canonical names — every name Finance could plausibly search by.
    const merchantOptions = Array.from(
      new Set([
        ...catalog.providers.map((p) => p.name),
        ...catalog.raw.map((r) => r.name),
        ...suggestions.map((s) => s.name),
      ])
    ).sort((a, b) => a.localeCompare(b));

    return (
      <MerchantReconciliationPage
        reviewedCount={reviewedCount}
        totalPaymentCount={allRows.length}
        recentBatchCount={batches.length}
        merchantOptions={merchantOptions}
        costHeadOptions={costHeadOptions}
      />
    );
  });
}
