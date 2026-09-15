import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFreshAuthUser, hasRole } from "@/lib/authz";
import { syncSalesforceLeads } from "@/lib/salesforceSync";
import { logAudit } from "@/lib/auditLog";

// Admin-triggered ("Sync now") rather than scheduled — this serverless
// architecture has no background cron; a real scheduled sync would need
// an Azure Function Timer Trigger, a separate later step.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await getFreshAuthUser(session);
  if (!hasRole(authUser, ["ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const limit = typeof body.limit === "number" ? body.limit : 200;

  try {
    const result = await syncSalesforceLeads(limit);

    await logAudit({
      actorId: authUser.id,
      actorEmail: session.user?.email ?? "unknown",
      action: "salesforce_lead_sync",
      targetId: undefined,
      details: `Fetched ${result.fetched}, created ${result.created}, refreshed ${result.updated}, ${result.unchanged} unchanged`,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Salesforce sync failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 502 }
    );
  }
}
