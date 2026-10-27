import { NextResponse } from "next/server";
import { previewLedgerImport } from "@/lib/finance/ledgerImportData";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Select a file to upload" }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      try {
        const preview = await previewLedgerImport(buffer, file.name);
        return NextResponse.json(preview);
      } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to read file" }, { status: 400 });
      }
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
