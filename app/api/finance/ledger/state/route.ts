import { NextResponse } from "next/server";
import { getFinanceState } from "@/lib/finance/ledgerData";
import { getUserDepartmentScope } from "@/lib/finance/departmentAccess";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// The mega-join powering most Finance ledger/reporting screens — direct
// equivalent of the source Python app's /api/state endpoint.
export async function GET() {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // Department-scoped users get only their departments' payments, like their screens.
      const state = await getFinanceState(await getUserDepartmentScope(authUser.id));
      return NextResponse.json(state);
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
