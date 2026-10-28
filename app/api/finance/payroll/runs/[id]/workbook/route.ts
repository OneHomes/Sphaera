import { NextResponse } from "next/server";
import { buildReviewWorkbook } from "@/lib/finance/payrollImport";
import { getDepartmentCatalogue, getPayrollRun } from "@/lib/finance/payrollData";
import { payrollRoute, xlsxResponse } from "@/lib/finance/payrollRoute";

// The stored run (with any Finance edits) re-exported in the review-workbook layout.
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  return payrollRoute(async ({ audit }) => {
    const run = await getPayrollRun(params.id);
    if (!run) return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    const buf = await buildReviewWorkbook({
      sourceName: run.sourceName,
      payPeriod: run.payPeriod,
      fxPkrPerUsd: run.fxPkrPerUsd,
      fxFromSource: true,
      lines: run.lines,
      sourceTotals: run.sourceTotals,
      departments: await getDepartmentCatalogue(),
    });
    await audit("workbook_exported", `Exported payroll run workbook (${run.lines.length} employees)`, run.id);
    return xlsxResponse(buf, `Sphaera_People_Costs_${run.payPeriod ?? "unconfirmed"}.xlsx`);
  });
}
