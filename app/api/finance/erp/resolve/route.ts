import { NextResponse } from "next/server";
import { resolveErpItem } from "@/lib/finance/erpRegistryData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Manually matches a staged ERP record against a real FinanceTransaction
// — direct port of resolve_erp_item().
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      const result = await resolveErpItem({
        stagedId: String(body.stagedId ?? ""),
        transactionId: String(body.transactionId ?? ""),
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_erp_item_resolved",
        targetId: result.linked,
        details: `Linked staged ERP record ${body.stagedId} to transaction ${result.linked}`,
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
