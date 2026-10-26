import { NextResponse } from "next/server";
import { stageErpItems } from "@/lib/finance/erpRegistryData";
import { hasValidErpSyncToken, runAsOneHomesTenant } from "@/lib/finance/erpSyncAuth";

// Inbound ERP payment staging — machine-to-machine endpoint, not a
// user-session route. No real ERP system calls this yet (see
// lib/finance/erpRegistryData.ts's module comment); this is the
// receiving end for when one does, authenticated by
// FINANCE_ERP_SYNC_TOKEN instead of withTenant(). Direct port of
// stage_erp_items().
export async function POST(request: Request) {
  if (!hasValidErpSyncToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const result = await runAsOneHomesTenant(() =>
    stageErpItems({
      sourceId: String(body.sourceId ?? ""),
      payments: Array.isArray(body.payments) ? body.payments : [],
    })
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result);
}
