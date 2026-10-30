import { NextResponse } from "next/server";
import { supplierClusterSuggestions } from "@/lib/finance/merchantReconcileData";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";

// Conservative, non-automatic supplier-name clustering suggestions —
// nothing here is auto-applied; Finance must explicitly approve a
// suggested cluster via POST /api/finance/merchant/providers.
export async function GET() {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance || (await isDepartmentScoped(authUser.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const suggestions = await supplierClusterSuggestions();
      return NextResponse.json({ suggestions });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
