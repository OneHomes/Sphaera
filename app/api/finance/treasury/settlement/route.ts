import { NextResponse } from "next/server";
import { recordSettlement } from "@/lib/finance/treasuryData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Records a Stripe / Trust Payments processor payout and (optionally)
// reconciles it against a bank ledger movement — direct wrap of
// recordSettlement(). Re-posting the same { provider, payoutId } updates
// the existing settlement row rather than creating a duplicate, matching
// recordSettlement's own upsert-by-(provider, payoutId) behaviour.
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      const result = await recordSettlement({
        provider: body.provider,
        payoutId: body.payoutId,
        bankAccountId: body.bankAccountId,
        currency: body.currency,
        fund: body.fund,
        status: body.status,
        gross: body.gross,
        fees: body.fees,
        refunds: body.refunds,
        disputes: body.disputes,
        reserve: body.reserve,
        otherAdjustments: body.otherAdjustments,
        expectedDate: body.expectedDate,
        actualDate: body.actualDate,
        reconciledLedgerId: body.reconciledLedgerId,
        merchantAccount: body.merchantAccount,
        legalEntity: body.legalEntity,
        note: body.note,
        source: body.source,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_treasury_settlement_recorded",
        targetId: result.id,
        details: `Recorded ${body.provider ?? ""} settlement ${body.payoutId ?? ""} (net ${result.net}) against bank account ${body.bankAccountId}`,
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
