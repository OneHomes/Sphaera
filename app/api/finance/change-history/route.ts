import { NextResponse } from "next/server";
import { getChangeHistory } from "@/lib/finance/changeJournal";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";

export async function GET() {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance || (await isDepartmentScoped(authUser.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const changes = await getChangeHistory();
      return NextResponse.json({ changes });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
