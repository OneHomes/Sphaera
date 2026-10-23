import { NextResponse } from "next/server";
import { hasRole } from "@/lib/authz";
import { syncHubSpotActivity } from "@/lib/hubspotActivitySync";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Admin-triggered, same pattern as /api/admin/hubspot-sync — pulls full
// call/email/meeting/note/task history for every already-synced lead
// into the shared LeadTimelineEvent table.
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
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
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
