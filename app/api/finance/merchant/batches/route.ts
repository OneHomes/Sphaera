import { NextResponse } from "next/server";
import { createMerchantReviewBatch, listRecentMerchantBatches } from "@/lib/finance/merchantReconcileData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Review-batch lifecycle tracking (export/commit bookkeeping) for the
// merchant/cost-head/FY Excel round-trip workflow.
export async function GET() {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const batches = await listRecentMerchantBatches();
      return NextResponse.json({ batches });
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
      const batch = await createMerchantReviewBatch({
        organizationId: authUser.organizationId,
        merchant: body.merchant,
        costHead: body.costHead,
        fyStart: body.fyStart,
      });
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_merchant_batch_created",
        targetId: batch.id,
        details: `Created merchant review batch${body.merchant ? ` for ${body.merchant}` : ""}${body.costHead ? ` / ${body.costHead}` : ""}`,
      });
      return NextResponse.json(batch, { status: 201 });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
