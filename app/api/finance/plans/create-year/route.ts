import { NextResponse } from "next/server";
import { createApprovedFinancialYear } from "@/lib/finance/financialPlanningData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// The CEO one-step planning form: creates AND immediately approves a full
// annual budget in a single call, no spreadsheet round trip. Direct wrap
// of createApprovedFinancialYear(), which does its own validation and
// always returns a { ok: false, status, error } shape on failure rather
// than throwing.
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const body = await request.json();
      const result = await createApprovedFinancialYear(body);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_plan_year_created",
        targetId: result.id,
        details: `Created and approved ${result.fy} plan (version ${result.version}, ${result.heads} budget lines, $${result.spendingBudgetUsd} spending budget)`,
      });

      return NextResponse.json(result, { status: 201 });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
