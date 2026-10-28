import { NextResponse } from "next/server";
import { importPeople } from "@/lib/finance/peopleImport";
import { payrollRoute } from "@/lib/finance/payrollRoute";

// v41 /api/people/commit. The source kept the previewed rows behind a server token; here the same
// file is re-sent and re-validated, so the commit never trusts rows edited on the client and works
// across server instances.
export async function POST(request: Request) {
  return payrollRoute(async ({ userId, email, audit }) => {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Upload the previewed workbook again." }, { status: 400 });
    try {
      const result = await importPeople(await file.arrayBuffer(), { id: userId, email });
      await audit("people_imported", `People directory import from ${file.name}: ${result.added} added, ${result.updated} updated`);
      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Import failed" }, { status: 400 });
    }
  });
}
