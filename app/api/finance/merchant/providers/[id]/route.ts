import { NextResponse } from "next/server";
import { ungroupSupplierAlias } from "@/lib/finance/merchantReconcileData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";

// Removes one approved alias from a provider ("ungroup"). [id] is the
// FinanceMerchantProvider id; the exact alias to remove is passed in the
// body since a provider can have many aliases. ungroupSupplierAlias
// already records this via logReversible/revisionItems internally — the
// logAudit call below is the normal audit-trail entry on top.
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance || (await isDepartmentScoped(authUser.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json().catch(() => ({}));
      if (!body.alias) {
        return NextResponse.json({ error: "alias is required" }, { status: 400 });
      }
      const result = await ungroupSupplierAlias({
        organizationId: authUser.organizationId,
        providerId: params.id,
        alias: String(body.alias),
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_merchant_alias_ungrouped",
        targetId: params.id,
        details: `Removed supplier alias "${body.alias}" from provider ${params.id}`,
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
