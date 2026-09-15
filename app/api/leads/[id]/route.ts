import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toUiLead, toUiNote, toUiTimelineEvent } from "@/lib/leadTransform";
import { getFreshAuthUser, canAccessRecord } from "@/lib/authz";
import { getAexConfig, getUserTier } from "@/lib/aexConfig";
import { LEAD_LOCK_HOURS } from "@/lib/leadLocks";
import { recalculateLeadScore } from "@/lib/leadScoring";
import { createNotification } from "@/lib/notifications";
import { awardPoints } from "@/lib/awardPoints";
import { logAudit } from "@/lib/auditLog";
import { leadStageRank } from "@/lib/leadData";
import { maybeCreateOpportunityFromLead } from "@/lib/leadToOpportunity";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await getFreshAuthUser(session);

  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      assignedUser: true,
      notes: { orderBy: { createdAt: "desc" } },
      timelineEvents: { orderBy: { occurredAt: "asc" } },
    },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (!canAccessRecord(authUser, lead.assignedUserId, lead.assignedUser?.teamId ?? null)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    lead: toUiLead(lead),
    notes: lead.notes.map(toUiNote),
    timeline: lead.timelineEvents.map(toUiTimelineEvent),
  });
}

const patchableFields = [
  "stage",
  "priority",
  "engagement",
  "assignment",
  "score",
  "nextAction",
] as const;

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await getFreshAuthUser(session);

  const body = await request.json();
  const existing = await prisma.lead.findUnique({
    where: { id: params.id },
    include: { assignedUser: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (
    !canAccessRecord(
      authUser,
      existing.assignedUserId,
      existing.assignedUser?.teamId ?? null
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Assignment claims go through a separate, capacity-checked, atomic
  // path (PRD R08 — Unfair Lead Allocation). This is intentionally
  // handled before the generic field-patch loop below, and the frontend
  // always sends assignedUserId on its own in this call (never combined
  // with other field changes), so returning early here is safe.
  if ("assignedUserId" in body && body.assignedUserId) {
    const newAssigneeId: string = body.assignedUserId;
    const isManagerOverride =
      existing.assignedUserId !== null &&
      newAssigneeId !== existing.assignedUserId &&
      (authUser.role === "ADMIN" ||
        (authUser.role === "MANAGER" &&
          authUser.teamId &&
          existing.assignedUser?.teamId === authUser.teamId));

    if (existing.assignedUserId !== null && !isManagerOverride && newAssigneeId !== authUser.id) {
      // Non-manager callers may only claim FOR THEMSELVES, and only from
      // the unassigned pool — reassigning someone else's lead requires
      // AV05 manager/admin authority (checked above).
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (newAssigneeId !== existing.assignedUserId) {
      const aexConfig = await getAexConfig();

      const activeCount = await prisma.lead.count({
        where: { assignedUserId: newAssigneeId },
      });

      if (activeCount >= aexConfig.maxActiveLeadAssignments) {
        return NextResponse.json(
          {
            error: `Capacity reached — that agent already has ${aexConfig.maxActiveLeadAssignments} active leads.`,
          },
          { status: 409 }
        );
      }

      // PRD 14.4/14.11 — Gold-tier "gated opportunity access": a
      // self-claim (not a manager override) of a top-scoring lead is
      // reserved for Gold-tier agents for a window after it enters the
      // pool, then opens to everyone. Placeholder threshold/window, same
      // governance note as the rest of AexConfig.
      if (
        !isManagerOverride &&
        existing.assignedUserId === null &&
        existing.score >= aexConfig.goldGateScoreThreshold &&
        Date.now() - existing.createdAt.getTime() < aexConfig.goldGateHours * 3_600_000
      ) {
        const { tier: callerTier } = await getUserTier(authUser.id);
        if (callerTier !== "Gold") {
          return NextResponse.json(
            {
              error: `This is a top-scoring lead (${existing.score}) — reserved for Gold-tier agents for the first ${aexConfig.goldGateHours}h. It opens to everyone after that.`,
            },
            { status: 403 }
          );
        }
      }

      if (isManagerOverride) {
        // PRD AV05 — manager/admin oversight reassignment of an
        // already-assigned lead. No race to guard against (this is an
        // authorized override, not a self-claim from the shared pool),
        // so a direct update is correct here, unlike the atomic claim
        // below.
        await prisma.lead.update({
          where: { id: params.id },
          data: {
            assignedUserId: newAssigneeId,
            assignment: "Locked",
            lockedUntil: new Date(Date.now() + LEAD_LOCK_HOURS * 3_600_000),
          },
        });

        // PRD AE17 — optional handover note travels with the
        // reassignment as a real note + timeline event, not just a
        // silent ownership change.
        if (typeof body.handoverNote === "string" && body.handoverNote.trim()) {
          const noteText = `Handover: ${body.handoverNote.trim()}`;
          await Promise.all([
            prisma.leadNote.create({
              data: {
                leadId: params.id,
                author: session.user?.name ?? session.user?.email ?? "Manager",
                text: noteText,
              },
            }),
            prisma.leadTimelineEvent.create({
              data: { leadId: params.id, type: "handover", summary: noteText },
            }),
          ]);
        }
      } else {
        // Atomic claim: only succeeds if the lead is still unassigned at
        // the moment of the update, preventing two agents from both
        // "winning" the same lead in a race and keeping allocation
        // fair/first-valid. PRD AE08 — the claim starts the lead
        // "Locked" for LEAD_LOCK_HOURS; it's released early to
        // "Assigned" on first logged activity (see the interactions
        // route), or back to the pool if that window expires with
        // nothing logged (lib/leadLocks.ts).
        const claim = await prisma.lead.updateMany({
          where: { id: params.id, assignedUserId: null },
          data: {
            assignedUserId: newAssigneeId,
            assignment: "Locked",
            lockedUntil: new Date(Date.now() + LEAD_LOCK_HOURS * 3_600_000),
          },
        });

        if (claim.count === 0) {
          return NextResponse.json(
            { error: "This lead was already claimed by someone else." },
            { status: 409 }
          );
        }
      }
    }

    const claimed = await prisma.lead.findUnique({
      where: { id: params.id },
      include: { assignedUser: true },
    });

    if (claimed) {
      await createNotification(
        newAssigneeId,
        "lead_assigned",
        "Lead assigned to you",
        `${claimed.name} — ${claimed.stage}`,
        `/leads/${claimed.id}`
      );

      // PRD PF07 — "lead assignment and reassignment" audited category.
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "lead_assigned",
        targetId: claimed.id,
        details: `${claimed.name} assigned to ${claimed.assignedUser?.name ?? newAssigneeId}`,
      });
    }

    return NextResponse.json(toUiLead(claimed!));
  }

  const data: Record<string, unknown> = {};
  for (const field of patchableFields) {
    if (field in body) data[field] = body[field];
  }

  const updated = await prisma.lead.update({
    where: { id: params.id },
    data,
    include: { assignedUser: true },
  });

  // Record a stage change on the timeline so the audit trail reflects it
  // (PRD 4.3 "Closed Revenue Loop" / PF07 audit trail requirement).
  if (body.stage && body.stage !== existing.stage) {
    await prisma.leadTimelineEvent.create({
      data: {
        leadId: params.id,
        type: "stage_change",
        summary: `Stage changed from ${existing.stage} to ${body.stage}`,
      },
    });

    // PRD AEX 14.1 — real point award when a lead moves FORWARD to a
    // more advanced stage (not on a lateral/backward move). PLACEHOLDER
    // rank/points, same governance note as the rest of AEX.
    if (updated.assignedUserId) {
      const rank = leadStageRank[body.stage] ?? 0;
      const previousRank = leadStageRank[existing.stage] ?? 0;
      if (rank > previousRank) {
        try {
          await awardPoints(
            updated.assignedUserId,
            updated.assignedUser?.email ?? "unknown",
            `${existing.name} advanced to ${body.stage}`,
            rank * 3
          );
        } catch (err) {
          console.error("Point award failed:", err);
        }
      }
    }

    // Real trigger — a manual stage change inside Sphaera is exactly how
    // most deals will actually form here (this org has no populated
    // Salesforce Opportunity object to sync — see lib/leadToOpportunity.ts).
    // No-op unless this move crosses into deal-rank and no Opportunity
    // exists for the lead yet.
    try {
      await maybeCreateOpportunityFromLead(params.id);
    } catch (err) {
      console.error("Opportunity auto-creation failed:", err);
    }

    // PRD AE07 — stage progression is one of this lead's scoring factors,
    // so a stage change is one of the two real events (alongside logging
    // an interaction) that should trigger a recalculation.
    try {
      const rescored = await recalculateLeadScore(params.id);
      return NextResponse.json(
        toUiLead({
          ...updated,
          score: rescored.score,
          prioritizationReason: `${rescored.topFactor.label} (+${rescored.topFactor.points} pts)`,
        })
      );
    } catch (err) {
      console.error("Lead score recalculation failed:", err);
    }
  }

  return NextResponse.json(toUiLead(updated));
}