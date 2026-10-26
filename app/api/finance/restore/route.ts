import { NextResponse } from "next/server";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Honest stub: the source app's /api/restore was not part of the Stage
// 3/4 backend port. Payroll-gated to match the Data & Backups screen.
// Returns 501 rather than pretending to restore anything from the
// uploaded file.
export async function POST() {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinancePayroll) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.json({ error: "Finance restore is not yet implemented" }, { status: 501 });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
