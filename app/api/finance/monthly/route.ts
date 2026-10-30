import { NextResponse } from "next/server";
import { updateMonth } from "@/lib/finance/ledgerData";
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
      if (!body.month) {
        return NextResponse.json({ error: "month is required" }, { status: 400 });
      }
      await updateMonth({
        month: String(body.month),
        collections: body.collections !== undefined ? Number(body.collections) : undefined,
        collectionsPlan: body.collectionsPlan !== undefined ? Number(body.collectionsPlan) : undefined,
        salesPlan: body.salesPlan !== undefined ? Number(body.salesPlan) : undefined,
        opexBudget: body.opexBudget !== undefined ? Number(body.opexBudget) : undefined,
      });
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_monthly_figures_updated",
        details: `Updated monthly figures for ${body.month}`,
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
