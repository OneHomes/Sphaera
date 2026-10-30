import { NextResponse } from "next/server";
import { subscriptionSplitPreview } from "@/lib/finance/paymentTraceData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";

// Applies the split — writes FinancePaymentCostSplit rows and an
// undoable change-journal entry (handled inside subscriptionSplitPreview
// itself when apply: true).
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance || (await isDepartmentScoped(authUser.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      const actorEmail = session.user?.email ?? "unknown";
      const result = await subscriptionSplitPreview({
        subscriptionId: String(body.subscriptionId ?? ""),
        replaceExisting: Boolean(body.replaceExisting),
        apply: true,
        actorId: authUser.id,
        actorEmail,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      await logAudit({
        actorId: authUser.id,
        actorEmail,
        action: "finance_subscription_split_approved",
        targetId: result.subscriptionId,
        details: `Approved shared-cost split for "${result.service}" across ${result.approvedPayments ?? 0} payment(s)`,
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
