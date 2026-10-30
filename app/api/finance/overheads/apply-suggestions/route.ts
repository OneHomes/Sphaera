import { NextResponse } from "next/server";
import { applySuggestedOverheads } from "@/lib/finance/peopleOverheadsData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";

// Bulk-applies up to 100 suggested cost-head rules, skipping any cost
// head that already has a rule.
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinancePayroll || (await isDepartmentScoped(authUser.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      const result = await applySuggestedOverheads({
        rules: Array.isArray(body.rules) ? body.rules : [],
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_overhead_suggestions_applied",
        details: `Applied ${result.applied} suggested overhead rule(s)`,
      });
      return NextResponse.json({ ok: true, applied: result.applied, changeId: result.changeId });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
