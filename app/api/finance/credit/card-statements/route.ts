import { NextResponse } from "next/server";
import { listCardStatements, saveCardStatement } from "@/lib/finance/creditCycleData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function GET(request: Request) {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const { searchParams } = new URL(request.url);
      const cardRuleId = searchParams.get("cardRuleId") ?? undefined;
      const statements = await listCardStatements(cardRuleId);
      return NextResponse.json({ statements });
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
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      if (!body.cardRuleId) {
        return NextResponse.json({ error: "cardRuleId is required" }, { status: 400 });
      }
      const result = await saveCardStatement({
        id: body.id,
        cardRuleId: String(body.cardRuleId),
        closingDate: body.closingDate,
        amount: body.amount,
        minimumDue: body.minimumDue,
        amountPaid: body.amountPaid,
        status: body.status,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: body.id ? "finance_credit_card_statement_updated" : "finance_credit_card_statement_created",
        targetId: result.id,
        details: `Saved card statement ${result.id} for cycle ${body.cardRuleId}`,
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
