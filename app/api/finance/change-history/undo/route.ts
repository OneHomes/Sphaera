import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { undoChange } from "@/lib/finance/changeJournal";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { isDepartmentScoped } from "@/lib/finance/departmentAccess";

export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance || (await isDepartmentScoped(authUser.id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      const journalId = String(body.id ?? "");
      if (!journalId) {
        return NextResponse.json({ error: "Choose a history entry." }, { status: 400 });
      }

      // Undoing a personnel-cost-allocation change is payroll-gated, same
      // as the source app's credit_allowed_payroll() guard on this one
      // specific undo path — every other revertible table only needs
      // general Finance access.
      const entry = await prisma.financeChangeJournal.findUnique({ where: { id: journalId } });
      if (entry) {
        const touchesPersonnel =
          entry.beforeJson.includes("FinancePersonCostAllocation") ||
          entry.afterJson.includes("FinancePersonCostAllocation");
        if (touchesPersonnel && !authUser.canAccessFinancePayroll) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }

      const actorEmail = session.user?.email ?? "unknown";
      const result = await undoChange(journalId, authUser.id, actorEmail);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }

      await logAudit({
        actorId: authUser.id,
        actorEmail,
        action: "finance_change_undone",
        targetId: journalId,
        details: `Undid change journal entry ${journalId} (${result.restoredRecords} record(s) restored)`,
      });

      return NextResponse.json({ ok: true, undone: result.undone, restoredRecords: result.restoredRecords });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
