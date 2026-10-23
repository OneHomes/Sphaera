import { NextResponse } from "next/server";
import { hasRole } from "@/lib/authz";
import { syncHubSpotLeads } from "@/lib/hubspotSync";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Admin-triggered ("Sync now") rather than scheduled — this serverless
// architecture has no background cron; a real scheduled sync would need
// an Azure Function Timer Trigger, a separate later step.
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!hasRole(authUser, ["ADMIN"])) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const body = await request.json().catch(() => ({}));
      const limit = typeof body.limit === "number" ? body.limit : 200;

      try {
        const result = await syncHubSpotLeads(limit);

        await logAudit({
          actorId: authUser.id,
          actorEmail: session.user?.email ?? "unknown",
          action: "hubspot_lead_sync",
          targetId: undefined,
          details: `Fetched ${result.fetched}, created ${result.created}, refreshed ${result.updated}, ${result.unchanged} unchanged`,
        });

        return NextResponse.json(result);
      } catch (err) {
        console.error("HubSpot sync failed:", err);
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
