import { NextResponse } from "next/server";
import { renameDepartment } from "@/lib/finance/ledgerData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      const oldName = String(body.oldName ?? "");
      const newName = String(body.newName ?? "");
      const result = await renameDepartment(oldName, newName);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_department_renamed",
        details: `Renamed Finance department "${oldName}" to "${newName}"`,
      });
      return NextResponse.json({ ok: true, name: newName });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
