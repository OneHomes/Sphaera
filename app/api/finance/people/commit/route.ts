import { NextResponse } from "next/server";
import { importPeople, rawRowsFromJson } from "@/lib/finance/peopleImport";
import { payrollRoute } from "@/lib/finance/payrollRoute";

// v41 /api/people/commit. The source kept the previewed rows behind a server token; here the rows
// (as uploaded, plus any corrections made on the preview screen) are sent back and fully
// re-validated server-side before anything is saved, so the client's preview result is never trusted.
export async function POST(request: Request) {
  return payrollRoute(async ({ audit }) => {
    try {
      const body = await request.json();
      const result = await importPeople(rawRowsFromJson(body.rows));
      const source = typeof body.fileName === "string" ? body.fileName.slice(0, 120) : "Excel upload";
      await audit(
        "people_imported",
        `People directory import from ${source}: ${result.added} added, ${result.updated} updated, ${result.unchanged} unchanged`
      );
      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Import failed" }, { status: 400 });
    }
  });
}
