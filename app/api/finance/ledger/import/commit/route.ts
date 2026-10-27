import { NextResponse } from "next/server";
import { commitLedgerImport } from "@/lib/finance/ledgerImportData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      if (!body.filename || !Array.isArray(body.newRows)) {
        return NextResponse.json({ error: "Re-check the file first — the preview result is missing." }, { status: 400 });
      }
      try {
        const result = await commitLedgerImport({
          filename: String(body.filename),
          mode: String(body.mode ?? ""),
          sheets: Array.isArray(body.sheets) ? body.sheets.map(String) : [],
          newRows: body.newRows,
          monthlyData: Array.isArray(body.monthlyData) ? body.monthlyData : [],
        });
        await logAudit({
          actorId: authUser.id,
          actorEmail: session.user?.email ?? "unknown",
          action: "finance_ledger_import_committed",
          targetId: result.importId,
          details: `Imported ${body.filename}: ${result.added} new payment(s), ${result.addedAmount} USD`,
        });
        return NextResponse.json(result);
      } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to add payments" }, { status: 400 });
      }
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
