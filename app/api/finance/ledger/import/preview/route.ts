import { NextResponse } from "next/server";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Honest stub: importing a new month's ledger/cost-centre-detail XLSX was
// not part of the Stage 3/4 backend port (no parsing/validation logic
// exists in lib/finance for it yet, unlike the source app's
// /api/import/preview). This route exists so the Upload New Months screen
// has something to call, but it deliberately returns 501 rather than
// fabricating a fake preview.
export async function POST() {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.json(
        { error: "Ledger XLSX import is not yet implemented" },
        { status: 501 }
      );
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
