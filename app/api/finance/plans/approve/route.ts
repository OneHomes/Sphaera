import { NextResponse } from "next/server";
import { approveFinancialPlan } from "@/lib/finance/financialPlanningData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Approves an existing Draft plan (committed via /commit, or a revision
// of a prior Approved one). Like commitFinancialPlan(), approveFinancialPlan()
// does not wrap itself in a try/catch (financeInputText on the plan id can
// throw a plain Error), so it's caught here and reported as a 400.
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const body = await request.json();
      let result;
      try {
        result = await approveFinancialPlan({ id: body.id });
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
        action: "finance_plan_approved",
        targetId: result.id,
        details: `Approved Finance plan (${result.rows} budget lines)`,
      });

      return NextResponse.json(result);
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
