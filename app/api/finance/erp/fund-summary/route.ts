import { NextResponse } from "next/server";
import { getErpFundSummary } from "@/lib/finance/erpRegistryData";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Pending ERP fund-movement totals awaiting treasury posting — adapted
// port of erp_fund_summary().
export async function GET() {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const summary = await getErpFundSummary();
      return NextResponse.json(summary);
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
