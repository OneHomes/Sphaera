import { NextResponse } from "next/server";
import { changeOverheadRule } from "@/lib/finance/peopleOverheadsData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";

// Tags (or clears, when nature/behaviour are blank) the cost-head-level
// overhead nature/behaviour rule. Payroll-only: this is classification
// detail adjacent to cost/salary data, same gate as the rest of this
// sub-domain.
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinancePayroll || (await isDepartmentScoped(authUser.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      const result = await changeOverheadRule({
        costHead: String(body.costHead ?? ""),
        nature: body.nature,
        behaviour: body.behaviour,
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_overhead_rule_changed",
        targetId: body.costHead,
        details: `Changed overhead rule for cost head "${body.costHead}"`,
      });
      return NextResponse.json({ ok: true, changeId: result.changeId });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
