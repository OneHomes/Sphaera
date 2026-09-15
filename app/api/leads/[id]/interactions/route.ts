import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toUiTimelineEvent } from "@/lib/leadTransform";
import { getAuthUser, canAccessRecord } from "@/lib/authz";
import { recalculateLeadScore } from "@/lib/leadScoring";
import { recordDailyActivity } from "@/lib/streaks";
import { awardBadgeIfNew } from "@/lib/badges";
import { awardPoints } from "@/lib/awardPoints";
import { logAudit } from "@/lib/auditLog";

// PRD AEX 14.1 — PLACEHOLDER point values per interaction type, not
// business-approved, same governance note as the rest of AEX. Real
// trigger (a real interaction was actually logged), not a fabricated one.
const INTERACTION_POINTS: Record<string, number> = {
  call: 5,
  email: 3,
  meeting: 10,
};

// PRD AE11/AE12/PF05 — the one place a real call/email/meeting gets
// logged against a lead. Everything downstream (Productivity Index,
// Target progress, Mission Centre, the dashboard's hour-by-hour charts)
// reads LeadTimelineEvent rows of these types, so this is the missing
// link that makes all of that reflect real activity instead of staying
// at zero.

const INTERACTION_TYPES = new Set(["call", "email", "meeting"]);

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = getAuthUser(session);

  const body = await request.json();
  if (!INTERACTION_TYPES.has(body.type)) {
    return NextResponse.json(
      { error: "type must be one of: call, email, meeting" },
      { status: 400 }
    );
  }
  if (!body.summary || typeof body.summary !== "string" || !body.summary.trim()) {
    return NextResponse.json(
      { error: "summary is required" },
      { status: 400 }
    );
  }

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: { assignedUser: true, timelineEvents: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }
  if (
    !canAccessRecord(authUser, lead.assignedUserId, lead.assignedUser?.teamId ?? null)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isFirstContact = !lead.timelineEvents.some((e) =>
    INTERACTION_TYPES.has(e.type)
  );

  const now = new Date();
  const event = await prisma.leadTimelineEvent.create({
    data: {
      leadId: params.id,
      type: body.type,
      summary: body.summary.trim(),
      occurredAt: now,
    },
  });

  // PRD AE08 — logging the required first activity releases an early
  // lock rather than making the agent wait out the full window.
  const shouldEarlyUnlock =
    lead.assignment === "Locked" && lead.assignedUserId === authUser.id;

  await prisma.lead.update({
    where: { id: params.id },
    data: {
      lastInteractionAt: now,
      ...(shouldEarlyUnlock ? { assignment: "Assigned", lockedUntil: null } : {}),
    },
  });

  // PRD AE07 — a real interaction is exactly the kind of behaviour this
  // lead's score should react to (speed-to-contact, frequency, recency
  // all just changed). Best-effort: a scoring hiccup shouldn't fail the
  // interaction log itself.
  try {
    await recalculateLeadScore(params.id);
  } catch (err) {
    console.error("Lead score recalculation failed:", err);
  }

  // PRD AEX 14.9 — logging real activity is this build's proxy for "the
  // day's mission is being worked" (see lib/streaks.ts for why).
  try {
    await recordDailyActivity(authUser.id);
  } catch (err) {
    console.error("Streak update failed:", err);
  }

  // PRD AEX 14.1 — real automatic point award for the logged activity.
  try {
    await awardPoints(
      authUser.id,
      session.user?.email ?? "unknown",
      `Logged a ${body.type}`,
      INTERACTION_POINTS[body.type] ?? 0
    );
  } catch (err) {
    console.error("Point award failed:", err);
  }

  // PRD AEX 14.8 — real trigger: this is the lead's first-ever logged
  // contact, and it happened within an hour of the lead being created.
  const hoursSinceCreated = (now.getTime() - lead.createdAt.getTime()) / 3_600_000;
  if (isFirstContact && hoursSinceCreated <= 1) {
    try {
      await awardBadgeIfNew(
        authUser.id,
        "Speed to Lead",
        "Made first contact with a lead within 1 hour of it being created"
      );
    } catch (err) {
      console.error("Badge award failed:", err);
    }
  }

  // PRD PF07 — "communications sent through Sphaera". Only email-type
  // interactions represent an actual message sent (a logged call is just
  // a record of an action taken outside the system); this also naturally
  // covers the Janus composer's "Log as sent", since it posts here too.
  if (body.type === "email") {
    try {
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "communication_sent",
        targetId: params.id,
        details: `Email logged for ${lead.name}: ${body.summary.trim().slice(0, 140)}`,
      });
    } catch (err) {
      console.error("Audit log failed:", err);
    }
  }

  return NextResponse.json(toUiTimelineEvent(event), { status: 201 });
}
