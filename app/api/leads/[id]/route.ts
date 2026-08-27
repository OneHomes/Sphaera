import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toUiLead, toUiNote, toUiTimelineEvent } from "@/lib/leadTransform";
import { getAuthUser, canAccessRecord } from "@/lib/authz";
import { MAX_ACTIVE_LEAD_ASSIGNMENTS } from "@/lib/allocationRules";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = getAuthUser(session);

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
  const authUser = getAuthUser(session);

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

    if (newAssigneeId !== existing.assignedUserId) {
      const activeCount = await prisma.lead.count({
        where: { assignedUserId: newAssigneeId },
      });

      if (activeCount >= MAX_ACTIVE_LEAD_ASSIGNMENTS) {
        return NextResponse.json(
          {
            error: `Capacity reached — you already have ${MAX_ACTIVE_LEAD_ASSIGNMENTS} active leads. Ask your manager to help redistribute before taking more.`,
          },
          { status: 409 }
        );
      }

      // Atomic claim: only succeeds if the lead is still unassigned at the
      // moment of the update, preventing two agents from both "winning"
      // the same lead in a race and keeping allocation fair/first-valid.
      const claim = await prisma.lead.updateMany({
        where: { id: params.id, assignedUserId: null },
        data: { assignedUserId: newAssigneeId },
      });

      if (claim.count === 0) {
        return NextResponse.json(
          { error: "This lead was already claimed by someone else." },
          { status: 409 }
        );
      }
    }

    const claimed = await prisma.lead.findUnique({
      where: { id: params.id },
      include: { assignedUser: true },
    });
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
  }

  return NextResponse.json(toUiLead(updated));
}