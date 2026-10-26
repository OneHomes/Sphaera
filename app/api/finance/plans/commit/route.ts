import { NextResponse } from "next/server";
import { commitFinancialPlan } from "@/lib/finance/financialPlanningData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Materializes a previously-validated /preview token as a Draft plan.
// Unlike createApprovedFinancialYear/previewFinancialPlan,
// commitFinancialPlan() does NOT wrap itself in a try/catch — an
// over-length plan name (financeInputText's 100-char cap) throws a plain
// Error rather than returning { ok: false }, so this route catches that
// itself and reports it the same way as the other 400s.
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const body = await request.json();
      let result;
      try {
        result = await commitFinancialPlan({ token: body.token, name: body.name });
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : String(err) },
          { status: 400 }
        );
      }
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_plan_committed",
        targetId: result.id,
        details: `Committed ${result.fy} plan as Draft (version ${result.version}, ${result.lines} budget lines, ${result.targets} monthly targets)`,
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
