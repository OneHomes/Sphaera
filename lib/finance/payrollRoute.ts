import { NextResponse } from "next/server";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { logAudit } from "@/lib/auditLog";
import { PayrollRuleError } from "@/lib/finance/payrollData";

type Ctx = { userId: string; email: string; audit: (action: string, details: string, targetId?: string) => Promise<void> };

/** Shared shell for /api/finance/payroll/*: tenant scope, payroll permission, rule errors -> 400. */
export async function payrollRoute(handler: (ctx: Ctx) => Promise<Response>): Promise<Response> {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinancePayroll) {
        return NextResponse.json({ error: "Payroll permission required." }, { status: 403 });
      }
      const email = session.user?.email ?? "unknown";
      const audit = (action: string, details: string, targetId?: string) =>
        logAudit({ actorId: authUser.id, actorEmail: email, action: `finance_payroll_${action}`, targetId, details });
      try {
        return await handler({ userId: authUser.id, email, audit });
      } catch (err) {
        if (err instanceof PayrollRuleError) return NextResponse.json({ error: err.message }, { status: 400 });
        if (err instanceof Error && /CSV|column|header|sheet|workbook/i.test(err.message)) {
          return NextResponse.json({ error: err.message }, { status: 400 });
        }
        throw err;
      }
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

export function xlsxResponse(buf: Buffer, filename: string) {
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.\- ()]/g, "_")}"`,
    },
  });
}
