import { NextResponse } from "next/server";
import { stageErpFundMovements } from "@/lib/finance/erpRegistryData";
import { hasValidErpSyncToken, runAsOneHomesTenant } from "@/lib/finance/erpSyncAuth";

// Inbound ERP fund-movement staging (queued for the treasury module to
// post) — machine-to-machine endpoint authenticated by
// FINANCE_ERP_SYNC_TOKEN. Adapted port of stage_erp_fund_movements(); see
// lib/finance/erpRegistryData.ts's stageErpFundMovements doc comment for
// the scope cut vs. the source (no treasury posting here).
export async function POST(request: Request) {
  if (!hasValidErpSyncToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const result = await runAsOneHomesTenant(() =>
    stageErpFundMovements({
      sourceId: String(body.sourceId ?? ""),
      movements: Array.isArray(body.movements) ? body.movements : [],
    })
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
