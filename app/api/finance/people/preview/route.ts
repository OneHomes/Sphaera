import { NextResponse } from "next/server";
import { readPeopleWorkbook, validatePeopleRows } from "@/lib/finance/peopleImport";
import { payrollRoute } from "@/lib/finance/payrollRoute";

// v41 /api/people/preview: validate the roster workbook and show what would change. Nothing is saved.
// rawRows are returned so the preview screen can correct rows and re-check them without a re-upload.
export async function POST(request: Request) {
  return payrollRoute(async () => {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a People Costs .xlsx file." }, { status: 400 });
    try {
      const rawRows = await readPeopleWorkbook(await file.arrayBuffer());
      const rows = await validatePeopleRows(rawRows);
      const errors = rows.filter((r) => r.errors.length).length;
      return NextResponse.json({ rawRows, rows, valid: rows.length - errors, errors });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid workbook" }, { status: 400 });
    }
  });
}
