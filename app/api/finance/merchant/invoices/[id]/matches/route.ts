import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { suggestPaymentMatchesForInvoice } from "@/lib/finance/merchantReconcileData";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Suggested ledger-payment matches for one invoice, ranked by
// supplier-name + amount match. Nothing here auto-links a payment — see
// POST /api/finance/merchant/invoices/[id]/link for the explicit approval
// step.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const invoice = await prisma.financeMerchantInvoice.findUnique({ where: { id: params.id } });
      if (!invoice) {
        return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      }
      const matches = await suggestPaymentMatchesForInvoice({
        supplier: invoice.supplier ?? "",
        amount: invoice.amount ?? 0,
        currency: invoice.currency ?? "",
        invoiceDateIso: invoice.invoiceDate ? invoice.invoiceDate.toISOString().slice(0, 10) : null,
      });
      return NextResponse.json({ matches });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
