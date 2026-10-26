import { NextResponse } from "next/server";
import { linkInvoiceToTransaction } from "@/lib/finance/merchantReconcileData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Records Finance's explicit approval of a suggested invoice-to-payment
// match. [id] is the invoice id; the transaction to link is in the body.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      if (!body.transactionId) {
        return NextResponse.json({ error: "transactionId is required" }, { status: 400 });
      }
      const result = await linkInvoiceToTransaction({
        organizationId: authUser.organizationId,
        invoiceId: params.id,
        transactionId: String(body.transactionId),
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      if (result.linked) {
        await logAudit({
          actorId: authUser.id,
          actorEmail: session.user?.email ?? "unknown",
          action: "finance_merchant_invoice_linked",
          targetId: params.id,
          details: `Linked invoice ${params.id} to payment ${body.transactionId}`,
        });
      }
      return NextResponse.json(result);
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
