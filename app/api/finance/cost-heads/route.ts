import { NextResponse } from "next/server";
import { createCostHead } from "@/lib/finance/ledgerData";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // Cost heads are shared by every department, so only unrestricted Finance users add them.
      if (await isDepartmentScoped(authUser.id)) {
        return NextResponse.json({ error: "Ask Finance to add new cost heads." }, { status: 403 });
      }
      const body = await request.json();
      const result = await createCostHead(String(body.name ?? ""));
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_cost_head_created",
        details: `Created Finance cost head "${body.name}"`,
      });
      return NextResponse.json({ ok: true, name: body.name }, { status: 201 });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
