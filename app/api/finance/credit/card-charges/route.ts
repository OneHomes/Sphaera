import { NextResponse } from "next/server";
import { listCardCharges, saveCardCharge } from "@/lib/finance/creditCycleData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function GET(request: Request) {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const { searchParams } = new URL(request.url);
      const statementId = searchParams.get("statementId") ?? undefined;
      const charges = await listCardCharges(statementId);
      return NextResponse.json({ charges });
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
      if (!body.statementId) {
        return NextResponse.json({ error: "statementId is required" }, { status: 400 });
      }
      const result = await saveCardCharge({
        id: body.id,
        statementId: String(body.statementId),
        merchant: body.merchant,
        amount: body.amount,
        currency: body.currency,
        reference: body.reference,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: body.id ? "finance_credit_card_charge_updated" : "finance_credit_card_charge_created",
        targetId: result.id,
        details: `Saved card charge "${body.merchant ?? ""}" on statement ${body.statementId}`,
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
