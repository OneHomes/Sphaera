import { NextResponse } from "next/server";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Honest stub: the source app's /api/backup (a full database dump/export)
// was not part of the Stage 3/4 backend port. Payroll-gated the same way
// the Data & Backups screen is, since a backup contains People Costs data.
// Returns 501 rather than streaming a fake or partial backup file.
export async function GET() {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinancePayroll) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.json({ error: "Finance backup export is not yet implemented" }, { status: 501 });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
