import { NextResponse } from "next/server";
import { rawRowsFromJson, validatePeopleRows } from "@/lib/finance/peopleImport";
import { payrollRoute } from "@/lib/finance/payrollRoute";

// Re-checks roster rows corrected on the preview screen. Nothing is saved.
export async function POST(request: Request) {
  return payrollRoute(async () => {
    try {
      const body = await request.json();
      const rows = await validatePeopleRows(rawRowsFromJson(body.rows));
      const errors = rows.filter((r) => r.errors.length).length;
      return NextResponse.json({ rows, valid: rows.length - errors, errors });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Invalid rows" }, { status: 400 });
    }
  });
}
