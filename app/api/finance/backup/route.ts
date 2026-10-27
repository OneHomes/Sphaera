import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Port of the source export_backup(): every Finance table for the current organisation as JSON.
// Payroll-gated because the backup contains People Costs.
export async function GET() {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinancePayroll) {
        return NextResponse.json({ error: "Payroll permission required to download a database backup." }, { status: 403 });
      }
      const models = Prisma.dmmf.datamodel.models.map((m) => m.name).filter((n) => n.startsWith("Finance"));
      const tables: Record<string, unknown[]> = {};
      for (const name of models) {
        const key = name.charAt(0).toLowerCase() + name.slice(1);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tables[name] = await (prisma as any)[key].findMany();
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_backup_export",
        details: `Exported ${models.length} finance tables`,
      });
      const body = JSON.stringify({ schema: "sphaera-finance-backup-v1", createdAt: new Date().toISOString(), tables });
      return new NextResponse(body, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="sphaera-finance-backup-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
