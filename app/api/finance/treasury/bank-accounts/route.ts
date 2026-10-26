import { NextResponse } from "next/server";
import { registerBankAccount, getTreasuryState } from "@/lib/finance/treasuryData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// treasuryData.ts has no dedicated "list bank accounts" read function — the
// only read path is getTreasuryState(), which already folds every bank
// account into its `banks` array together with ERP-reconciliation and
// allocation rollups. Rather than querying FinanceBankAccount directly here
// (which would duplicate business logic outside lib/finance), GET reuses
// getTreasuryState() and returns just its `banks` slice.
export async function GET() {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const state = await getTreasuryState();
      return NextResponse.json({ banks: state.banks });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

// Registers a new treasury bank account, or updates an existing one when
// body.id is provided — direct wrap of registerBankAccount().
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      const result = await registerBankAccount({
        id: body.id,
        label: body.label,
        bank: body.bank,
        legalEntity: body.legalEntity,
        currency: body.currency,
        maskedAccount: body.maskedAccount,
        country: body.country,
        erpSourceId: body.erpSourceId,
        erpAccountNumber: body.erpAccountNumber,
        erpAccountId: body.erpAccountId,
        paymentSourceId: body.paymentSourceId,
        usdPerUnit: body.usdPerUnit,
        fxAsOf: body.fxAsOf,
        active: body.active,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_treasury_bank_account_saved",
        targetId: result.id,
        details: `Saved Finance treasury bank account "${body.label ?? ""}" (${result.id})`,
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
