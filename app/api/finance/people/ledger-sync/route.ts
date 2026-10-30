import { NextResponse } from "next/server";
import { planLedgerDepartments, syncAllLedgerDepartments } from "@/lib/finance/peopleOverheadsData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";

// Already-linked payments whose ledger department / cost head doesn't match their employee yet.
// GET previews the count per department; POST moves them all as one undoable change.
export async function GET() {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinancePayroll || (await isDepartmentScoped(authUser.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const plan = await planLedgerDepartments();
      const byDepartment: Record<string, number> = {};
      for (const c of plan) byDepartment[c.department] = (byDepartment[c.department] ?? 0) + 1;
      return NextResponse.json({ count: plan.length, byDepartment });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

export async function POST() {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinancePayroll || (await isDepartmentScoped(authUser.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const result = await syncAllLedgerDepartments({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        organizationId: authUser.organizationId,
      });
      if (result.moved) {
        await logAudit({
          actorId: authUser.id,
          actorEmail: session.user?.email ?? "unknown",
          action: "finance_people_ledger_sync",
          targetId: result.changeId,
          details: `Moved ${result.moved} linked payments to their employee's department in the ledger`,
        });
      }
      return NextResponse.json({ ok: true, moved: result.moved, changeId: result.changeId });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
