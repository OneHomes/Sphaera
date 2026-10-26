import { NextResponse } from "next/server";
import { subscriptionSplitPreview } from "@/lib/finance/paymentTraceData";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Preview only — never writes. See split-approve for the apply path.
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const body = await request.json();
      const result = await subscriptionSplitPreview({
        subscriptionId: String(body.subscriptionId ?? ""),
        replaceExisting: Boolean(body.replaceExisting),
        apply: false,
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json(result);
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
