import { NextResponse } from "next/server";
import { listCardRules, saveCardRule } from "@/lib/finance/creditCycleData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";

export async function GET() {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance || (await isDepartmentScoped(authUser.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const cardRules = await listCardRules();
      return NextResponse.json({ cardRules });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance || (await isDepartmentScoped(authUser.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      const result = await saveCardRule({
        id: body.id,
        paymentAccountId: body.paymentAccountId,
        statementDay: body.statementDay,
        dueOffsetDays: body.dueOffsetDays,
        settlement: body.settlement,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: body.id ? "finance_credit_card_rule_updated" : "finance_credit_card_rule_created",
        targetId: result.id,
        details: `Saved company-card cycle rule ${result.id}`,
      });
      return NextResponse.json(result, { status: body.id ? 200 : 201 });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
