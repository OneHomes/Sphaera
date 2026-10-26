import { NextResponse } from "next/server";
import { postTreasuryMovement } from "@/lib/finance/treasuryData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Posts a bank movement with its mandatory fund-split allocation — direct
// wrap of postTreasuryMovement(). `allocations` is forwarded as-is (an
// array of { fund, amount }); postTreasuryMovement itself validates count,
// fund uniqueness, sign and exact-sum-to-movement rules.
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      const result = await postTreasuryMovement({
        bankAccountId: body.bankAccountId,
        transactionType: body.transactionType,
        amount: body.amount,
        date: body.date,
        allocations: Array.isArray(body.allocations) ? body.allocations : [],
        sourceUid: body.sourceUid,
        reference: body.reference,
        approvedBy: body.approvedBy,
        note: body.note,
        description: body.description,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_treasury_movement_posted",
        targetId: result.id,
        details: `Posted ${body.transactionType ?? "treasury"} movement ${result.sourceUid} of ${body.amount} on bank account ${body.bankAccountId}`,
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
