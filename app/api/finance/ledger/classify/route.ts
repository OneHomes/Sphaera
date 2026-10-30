import { NextResponse } from "next/server";
import { classifyTransaction } from "@/lib/finance/ledgerData";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { paymentsOutsideScope } from "@/lib/finance/departmentAccess";

export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      const outOfScope = await paymentsOutsideScope(authUser.id, [String(body.id ?? "")]);
      if (outOfScope) return NextResponse.json({ error: outOfScope }, { status: 403 });
      if (!body.id) {
        return NextResponse.json({ error: "id is required" }, { status: 400 });
      }
      const result = await classifyTransaction({
        transactionId: String(body.id),
        head: body.head,
        centre: body.centre,
        debtPeriod: body.debtPeriod,
        department: body.department,
        costHead: body.costHead,
        note: body.note,
        reviewed: Boolean(body.reviewed),
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ ok: true, changeId: result.changeId });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
