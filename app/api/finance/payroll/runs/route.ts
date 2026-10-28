import { NextResponse } from "next/server";
import { parsePayrollCsv, readReviewWorkbook } from "@/lib/finance/payrollImport";
import { getDepartmentCatalogue, listPayrollRuns, savePayrollRun } from "@/lib/finance/payrollData";
import { payrollRoute } from "@/lib/finance/payrollRoute";

export async function GET() {
  return payrollRoute(async () => NextResponse.json(await listPayrollRuns()));
}

// Upload a payroll master CSV or a reviewed People Costs workbook -> Draft payroll run.
export async function POST(request: Request) {
  return payrollRoute(async ({ email, audit }) => {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Attach a payroll CSV or reviewed workbook." }, { status: 400 });
    const catalogue = await getDepartmentCatalogue();
    const isXlsx = /\.xlsx$/i.test(file.name);
    const parsed = isXlsx
      ? await readReviewWorkbook(await file.arrayBuffer(), file.name, catalogue)
      : parsePayrollCsv(await file.text(), file.name, catalogue);
    if (!parsed.lines.length) return NextResponse.json({ error: "No employee rows found in the file." }, { status: 400 });
    const run = await savePayrollRun(parsed, email);
    await audit("run_imported", `Imported ${parsed.lines.length} payroll master rows from ${file.name} as a draft run`, run.id);
    return NextResponse.json({ id: run.id, employees: parsed.lines.length });
  });
}
