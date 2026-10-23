import { NextResponse } from "next/server";
import { hasRole } from "@/lib/authz";
import { getAexConfig, updateAexConfig } from "@/lib/aexConfig";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// PRD AV10 — AEX administration and governance. Admin-only read/write of
// the tier thresholds, Productivity Index weights, allocation caps, and
// tier-gating/Daily Club thresholds that used to be hardcoded constants.
export async function GET() {
  try {
    return await withTenant(async (authUser) => {
      if (!hasRole(authUser, ["ADMIN"])) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const config = await getAexConfig();
      return NextResponse.json(config);
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

export async function PATCH(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!hasRole(authUser, ["ADMIN"])) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const body = await request.json();
      const allowedFields = [
        "tierSilverMinPoints",
        "tierGoldMinPoints",
        "piWeightSpeedToLead",
        "piWeightOutput",
        "piWeightEngagementConversion",
        "piWeightInteractionFulfilment",
        "piWeightDataQuality",
        "maxActiveLeadAssignments",
        "maxActiveOpportunityAssignments",
        "goldGateScoreThreshold",
        "goldGateHours",
        "dailyClubPointThreshold",
      ] as const;

      const patch: Record<string, number> = {};
      for (const field of allowedFields) {
        if (field in body && typeof body[field] === "number" && !Number.isNaN(body[field])) {
          patch[field] = body[field];
        }
      }

      const updated = await updateAexConfig(patch, authUser.id);

      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "aex_config_changed",
        targetId: updated.id,
        details: `AEX config updated: ${Object.keys(patch).join(", ") || "no fields"}`,
      });

      return NextResponse.json(updated);
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
