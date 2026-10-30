import { NextResponse } from "next/server";
import { validateImportRows, commitMerchantReviewImport } from "@/lib/finance/merchantReconcileData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";

// Accepts already-parsed review rows (real XLSX upload parsing is a
// follow-up — see buildMerchantReviewExportRows()'s own doc comment on
// the export side for the same scope cut). `preview: true` just
// re-validates without writing anything (the "validate before commit"
// step); otherwise commits via commitMerchantReviewImport().
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance || (await isDepartmentScoped(authUser.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      const rows = Array.isArray(body.rows) ? body.rows : [];

      if (body.preview) {
        const validated = await validateImportRows(rows);
        return NextResponse.json({ rows: validated });
      }

      const result = await commitMerchantReviewImport({
        organizationId: authUser.organizationId,
        rows,
        allowOverwrite: Boolean(body.allowOverwrite),
        merchant: body.merchant,
        costHead: body.costHead,
        fyStart: body.fyStart !== undefined ? Number(body.fyStart) : undefined,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_merchant_review_imported",
        targetId: result.batchId,
        details: `Imported merchant review batch: ${result.applied} applied, ${result.skipped} skipped`,
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
