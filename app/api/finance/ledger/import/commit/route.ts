import { NextResponse } from "next/server";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Honest stub: see preview/route.ts's doc comment — committing a new
// month's ledger import has no backend logic in this port yet. Returns
// 501 rather than pretending to write anything.
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
