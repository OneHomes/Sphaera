import { NextResponse } from "next/server";
import { listInvoices, upsertInvoice } from "@/lib/finance/creditCycleData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function GET(request: Request) {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const { searchParams } = new URL(request.url);
      const status = searchParams.get("status") ?? undefined;
      const invoices = await listInvoices(status ? { status } : undefined);
      return NextResponse.json({ invoices });
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
      const result = await upsertInvoice({
        vendor: body.vendor,
        invoiceNumber: body.invoiceNumber,
        issueDate: body.issueDate,
        dueDate: body.dueDate,
        amount: body.amount,
        currency: body.currency,
        department: body.department,
        costHead: body.costHead,
        country: body.country,
        paymentSourceId: body.paymentSourceId,
        status: body.status,
        paidDate: body.paidDate,
        reference: body.reference,
        notes: body.notes,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_credit_invoice_created",
        targetId: result.id,
        details: `Created AP invoice "${body.vendor ?? ""}" for ${body.amount ?? ""} ${body.currency ?? ""}`,
      });
      return NextResponse.json(result, { status: 201 });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
