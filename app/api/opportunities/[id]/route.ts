import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toUiOpportunity } from "@/lib/opportunityTransform";
import { getAuthUser, canAccessRecord } from "@/lib/authz";
import { CLOSED_OPPORTUNITY_STAGES } from "@/lib/allocationRules";
import { getAexConfig } from "@/lib/aexConfig";
import { createNotification } from "@/lib/notifications";
import { awardBadgeIfNew } from "@/lib/badges";
import { awardPoints } from "@/lib/awardPoints";
const patchableFields = [
  "stage",
  "lossReason",
  "nextAction",
  "probability",
] as const;

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = getAuthUser(session);

  const body = await request.json();
  const existing = await prisma.opportunity.findUnique({
    where: { id: params.id },
    include: { assignedUser: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Opportunity not found" },
      { status: 404 }
    );
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
  // path (PRD R08 — Unfair Lead Allocation) — same pattern as
  // app/api/leads/[id]/route.ts.
  if ("assignedUserId" in body && body.assignedUserId) {
    const newAssigneeId: string = body.assignedUserId;

    if (newAssigneeId !== existing.assignedUserId) {
      const aexConfig = await getAexConfig();
      const activeCount = await prisma.opportunity.count({
        where: {
          assignedUserId: newAssigneeId,
          stage: { notIn: CLOSED_OPPORTUNITY_STAGES },
        },
      });

      if (activeCount >= aexConfig.maxActiveOpportunityAssignments) {
        return NextResponse.json(
          {
            error: `Capacity reached — you already have ${aexConfig.maxActiveOpportunityAssignments} active opportunities. Ask your manager to help redistribute before taking more.`,
          },
          { status: 409 }
        );
      }

      const claim = await prisma.opportunity.updateMany({
        where: { id: params.id, assignedUserId: null },
        data: { assignedUserId: newAssigneeId },
      });

           if (claim.count === 0) {
        return NextResponse.json(
          { error: "This opportunity was already claimed by someone else." },
          { status: 409 }
        );
      }
    }

    const claimed = await prisma.opportunity.findUnique({
      where: { id: params.id },
      include: { assignedUser: true },
    });

    if (claimed) {
      await createNotification(
        newAssigneeId,
        "opportunity_assigned",
        "Opportunity assigned to you",
        `${claimed.leadName} — $${claimed.value.toLocaleString()}`,
        "/pipeline"
      );
    }

    return NextResponse.json(toUiOpportunity(claimed!));
  }

  const data: Record<string, unknown> = {};
  for (const field of patchableFields) {
    if (field in body) data[field] = body[field];
  }

  if (body.stage && body.stage !== "Closed Lost" && !("lossReason" in body)) {
    data.lossReason = null;
  }

  const updated = await prisma.opportunity.update({
    where: { id: params.id },
    data,
    include: { assignedUser: true },
  });

  // PRD AEX 14.1/14.8 — real trigger: this opportunity just became
  // Closed Won. Points scale with deal value (PLACEHOLDER rate, not
  // business-approved), capped so one huge deal can't dwarf everything
  // else in the leaderboard.
  if (
    body.stage === "Closed Won" &&
    existing.stage !== "Closed Won" &&
    updated.assignedUserId
  ) {
    try {
      await awardBadgeIfNew(
        updated.assignedUserId,
        "Closer",
        "Won your first opportunity"
      );
    } catch (err) {
      console.error("Badge award failed:", err);
    }

    try {
      const dealPoints = Math.min(100, Math.round(updated.value / 1000));
      await awardPoints(
        updated.assignedUserId,
        updated.assignedUser?.email ?? "unknown",
        `Closed Won: ${updated.leadName}`,
        Math.max(20, dealPoints)
      );
    } catch (err) {
      console.error("Point award failed:", err);
    }
  }

  return NextResponse.json(toUiOpportunity(updated));
}