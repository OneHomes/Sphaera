import { NextResponse } from "next/server";
import { stageBankBalances } from "@/lib/finance/erpRegistryData";
import { hasValidErpSyncToken, runAsOneHomesTenant } from "@/lib/finance/erpSyncAuth";

// Inbound ERP bank-balance snapshot staging — machine-to-machine
// endpoint authenticated by FINANCE_ERP_SYNC_TOKEN. Direct port of
// stage_bank_balances().
export async function POST(request: Request) {
  if (!hasValidErpSyncToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const result = await runAsOneHomesTenant(() =>
    stageBankBalances({
      balances: Array.isArray(body.balances) ? body.balances : [],
    })
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
