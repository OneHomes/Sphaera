import { NextResponse } from "next/server";
import { matchErpRecord } from "@/lib/finance/paymentTraceData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";

export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance || (await isDepartmentScoped(authUser.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      const stagingId = String(body.stagingId ?? "");
      const transactionId = String(body.transactionId ?? "");
      if (!stagingId || !transactionId) {
        return NextResponse.json({ error: "stagingId and transactionId are required" }, { status: 400 });
      }
      const result = await matchErpRecord({ stagingId, transactionId });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_erp_record_matched",
        targetId: transactionId,
        details: `Matched ERP staging record ${stagingId} to payment ${transactionId}`,
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
