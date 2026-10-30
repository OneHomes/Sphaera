import { NextResponse } from "next/server";
import { getLatestErpBankBalances } from "@/lib/finance/erpRegistryData";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";

// Most recent ERP-sourced bank-balance snapshot per external account —
// direct port of latest_erp_bank_balances().
export async function GET() {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance || (await isDepartmentScoped(authUser.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const balances = await getLatestErpBankBalances();
      return NextResponse.json(balances);
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
