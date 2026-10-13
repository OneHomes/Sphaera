import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFreshAuthUser, hasRole } from "@/lib/authz";
import { syncHubSpotActivity } from "@/lib/hubspotActivitySync";
import { logAudit } from "@/lib/auditLog";

// Admin-triggered, same pattern as /api/admin/hubspot-sync — pulls full
// call/email/meeting/note/task history for every already-synced lead
// into the shared LeadTimelineEvent table.
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
  const leadLimit = typeof body.leadLimit === "number" ? body.leadLimit : 2500;

  try {
    const result = await syncHubSpotActivity(leadLimit);

    await logAudit({
      actorId: authUser.id,
      actorEmail: session.user?.email ?? "unknown",
      action: "hubspot_activity_sync",
      targetId: undefined,
      details: `Imported ${result.totalImported} activity events: ${Object.entries(result.perType)
        .map(([type, r]) => `${type}=${r.imported}${r.failed ? " (failed)" : ""}`)
        .join(", ")}`,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("HubSpot activity sync failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 502 }
    );
  }
}
