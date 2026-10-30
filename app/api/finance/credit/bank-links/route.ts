import { NextResponse } from "next/server";
import { listBankBalances, saveBankLink } from "@/lib/finance/creditCycleData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";

// GET lists every bank-account payment source with its resolved balance
// (ERP-reported, manual snapshot, or none) — this is the read surface for
// FinanceCreditBankLink records, since the business logic has no
// standalone "list links" helper (bank_sources()/balances() in the source
// always returns the resolved view, never raw links).
export async function GET() {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance || (await isDepartmentScoped(authUser.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const balances = await listBankBalances();
      return NextResponse.json({ balances });
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
      if (!body.paymentSourceId) {
        return NextResponse.json({ error: "paymentSourceId is required" }, { status: 400 });
      }
      const result = await saveBankLink({
        paymentSourceId: String(body.paymentSourceId),
        bankAccountId: body.bankAccountId,
        openingBalance: body.openingBalance,
        openingAsOf: body.openingAsOf,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_credit_bank_link_saved",
        targetId: result.id,
        details: `Saved bank link for payment source ${body.paymentSourceId}`,
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
