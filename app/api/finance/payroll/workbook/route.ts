import { NextResponse } from "next/server";
import { buildReviewWorkbook, parsePayrollCsv } from "@/lib/finance/payrollImport";
import { getDepartmentCatalogue } from "@/lib/finance/payrollData";
import { payrollRoute, xlsxResponse } from "@/lib/finance/payrollRoute";

// CSV payroll master -> controlled review workbook. Read-only: nothing is saved.
export async function POST(request: Request) {
  return payrollRoute(async ({ audit }) => {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Attach the payroll master CSV." }, { status: 400 });
    const parsed = parsePayrollCsv(await file.text(), file.name, await getDepartmentCatalogue());
    if (!parsed.lines.length) return NextResponse.json({ error: "No employee rows found (need Employee Name, Currency USD/PKR and Payable Salary)." }, { status: 400 });
    const buf = await buildReviewWorkbook(parsed);
    await audit("workbook_generated", `Generated People Costs review workbook from ${file.name} (${parsed.lines.length} employees)`);
    return xlsxResponse(buf, `Sphaera_People_Costs_${file.name.replace(/\.csv$/i, "")}.xlsx`);
  });
}
