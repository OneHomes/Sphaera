import { NextResponse } from "next/server";
import { approveSupplierCluster } from "@/lib/finance/merchantReconcileData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Approves a suggested (or ad-hoc) supplier-name cluster into a
// FinanceMerchantProvider/FinanceMerchantAlias pair. approveSupplierCluster
// already records this via logReversible/revisionItems internally (it's
// undoable through the change journal) — logAudit below is the normal
// audit-trail entry on top, same as every other Finance mutation.
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      const result = await approveSupplierCluster({
        organizationId: authUser.organizationId,
        providerName: String(body.providerName ?? ""),
        aliases: Array.isArray(body.aliases) ? body.aliases : [],
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_merchant_provider_approved",
        targetId: result.providerId,
        details: `Approved reporting supplier "${result.name}" with ${result.added} alias(es)`,
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
