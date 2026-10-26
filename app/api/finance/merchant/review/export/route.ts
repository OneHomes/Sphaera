import { NextResponse } from "next/server";
import { buildMerchantReviewExportRows } from "@/lib/finance/merchantReconcileData";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Returns the row data + per-cell lock map for a merchant/cost-head/FY
// review batch. Real XLSX byte generation (the source's protected-cell
// export) isn't wired up yet — buildMerchantReviewExportRows() already
// documents this as a later-stage concern once exceljs is used here the
// way it's used in lib/finance/financialPlanningData.ts's budget
// template. For now this returns the same row/lock data as JSON, which a
// client-side export step (or a follow-up exceljs pass) can render into
// the real protected workbook.
export async function GET(request: Request) {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const { searchParams } = new URL(request.url);
      const rows = await buildMerchantReviewExportRows({
        merchant: searchParams.get("merchant") ?? undefined,
        costHead: searchParams.get("costHead") ?? undefined,
        fyStart: searchParams.get("fyStart") ? Number(searchParams.get("fyStart")) : undefined,
      });
      return NextResponse.json({ rows });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
