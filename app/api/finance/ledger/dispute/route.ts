import { NextResponse } from "next/server";
import { markDisputed } from "@/lib/finance/ledgerData";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      if (!body.id) {
        return NextResponse.json({ error: "id is required" }, { status: 400 });
      }
      const result = await markDisputed({
        transactionId: String(body.id),
        status: body.status ?? "Open",
        reason: String(body.reason ?? ""),
        financeOwner: body.financeOwner,
        notes: body.notes,
        resolution: body.resolution,
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ ok: true, status: result.status, changeId: result.changeId });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
