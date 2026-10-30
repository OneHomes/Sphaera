import { NextResponse } from "next/server";
import { savePaymentTrace } from "@/lib/finance/paymentTraceData";
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
      const outOfScope = await paymentsOutsideScope(authUser.id, [String(body.transactionId ?? "")]);
      if (outOfScope) return NextResponse.json({ error: outOfScope }, { status: 403 });
      if (!body.transactionId) {
        return NextResponse.json({ error: "transactionId is required" }, { status: 400 });
      }
      const result = await savePaymentTrace(body);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_payment_trace_updated",
        targetId: String(body.transactionId),
        details: `Updated payment trace for ${body.transactionId}`,
      });
      return NextResponse.json({ ok: true });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
