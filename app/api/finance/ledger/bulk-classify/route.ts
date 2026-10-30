import { NextResponse } from "next/server";
import { bulkClassifyTransactions } from "@/lib/finance/ledgerData";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { paymentsOutsideScope } from "@/lib/finance/departmentAccess";

export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      const outOfScope = await paymentsOutsideScope(authUser.id, Array.isArray(body.ids) ? body.ids.map(String) : []);
      if (outOfScope) return NextResponse.json({ error: outOfScope }, { status: 403 });
      const result = await bulkClassifyTransactions({
        ids: Array.isArray(body.ids) ? body.ids.map(String) : [],
        department: String(body.department ?? ""),
        costHead: String(body.costHead ?? ""),
        note: body.note,
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ ok: true, updated: result.updated, changeId: result.changeId });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
