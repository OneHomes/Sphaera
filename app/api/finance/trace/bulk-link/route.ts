import { NextResponse } from "next/server";
import { bulkSubscriptionLink } from "@/lib/finance/paymentTraceData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { paymentsOutsideScope } from "@/lib/finance/departmentAccess";

export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      const outOfScope = await paymentsOutsideScope(authUser.id, Array.isArray(body.ids) ? body.ids.map(String) : []);
      if (outOfScope) return NextResponse.json({ error: outOfScope }, { status: 403 });
      const result = await bulkSubscriptionLink({
        ids: Array.isArray(body.ids) ? body.ids.map(String) : [],
        subscriptionId: String(body.subscriptionId ?? ""),
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_payments_bulk_linked",
        targetId: String(body.subscriptionId ?? ""),
        details: `Linked ${result.linked} payment(s) to subscription ${body.subscriptionId}`,
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
