import { NextResponse } from "next/server";
import { changeOverheadPaymentOverride } from "@/lib/finance/peopleOverheadsData";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { paymentsOutsideScope } from "@/lib/finance/departmentAccess";

// Tags (or clears) up to 5,000 individual payments' overhead
// nature/behaviour, overriding any cost-head rule for those transactions.
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinancePayroll) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      const outOfScope = await paymentsOutsideScope(authUser.id, Array.isArray(body.ids) ? body.ids.map(String) : [String(body.id ?? "")]);
      if (outOfScope) return NextResponse.json({ error: outOfScope }, { status: 403 });
      const result = await changeOverheadPaymentOverride({
        ids: Array.isArray(body.ids) ? body.ids.map(String) : undefined,
        id: body.id !== undefined ? String(body.id) : undefined,
        nature: body.nature,
        behaviour: body.behaviour,
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "finance_overhead_payment_override_changed",
        details: `Changed overhead classification for ${result.tagged} payment(s)`,
      });
      return NextResponse.json({ ok: true, tagged: result.tagged, changeId: result.changeId });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
