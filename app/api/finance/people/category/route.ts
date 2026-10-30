import { NextResponse } from "next/server";
import { changeAllocationCategory } from "@/lib/finance/peopleOverheadsData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";

// Changes the cost category of one personnel allocation line (history table dropdown).
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinancePayroll || (await isDepartmentScoped(authUser.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json().catch(() => ({}));
      const result = await changeAllocationCategory({
        allocationId: String(body.allocationId ?? ""),
        costType: body.costType,
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      if (result.changeId) {
        await logAudit({
          actorId: authUser.id,
          actorEmail: session.user?.email ?? "unknown",
          action: "finance_people_category_changed",
          targetId: String(body.allocationId),
          details: `Changed personnel cost category from ${result.previous} to ${result.costType}`,
        });
      }
      return NextResponse.json({ ok: true, costType: result.costType, changeId: result.changeId });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
