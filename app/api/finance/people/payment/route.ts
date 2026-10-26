import { NextResponse } from "next/server";
import { savePersonPayment } from "@/lib/finance/peopleOverheadsData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Replaces the full set of personnel cost-allocation lines attributed to
// one source payment.
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinancePayroll) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      const result = await savePersonPayment({
        transactionId: String(body.transactionId ?? ""),
        lines: Array.isArray(body.lines) ? body.lines : [],
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_people_payment_allocated",
        targetId: result.transactionId,
        details: `Attributed personnel costs to payment ${result.transactionId}: $${result.allocatedUsd} allocated, $${result.unallocatedUsd} unallocated`,
      });
      return NextResponse.json({
        ok: true,
        transactionId: result.transactionId,
        allocatedUsd: result.allocatedUsd,
        unallocatedUsd: result.unallocatedUsd,
        changeId: result.changeId,
      });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
