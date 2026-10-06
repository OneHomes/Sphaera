import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFreshAuthUser, hasRole } from "@/lib/authz";
import { logAudit } from "@/lib/auditLog";

// Doc: "an authorised resolution process so communication history and
// AEX events remain attached to the correct record." AEX point events
// are label-text only (no leadId FK anywhere in this build), so there's
// nothing to reassign there — notes/timeline/tags/opportunities DO have
// a real leadId FK, and merging reassigns all of them to the surviving
// lead before the duplicate record is removed.
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await getFreshAuthUser(session);
  if (!hasRole(authUser, ["MANAGER", "ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const flag = await prisma.duplicateLeadFlag.findUnique({ where: { id: params.id } });
  if (!flag) {
    return NextResponse.json({ error: "Flag not found" }, { status: 404 });
  }
  if (flag.status !== "pending") {
    return NextResponse.json({ error: `This flag is already ${flag.status}` }, { status: 409 });
  }

  const body = await request.json();
  const actorName = session.user?.name ?? session.user?.email ?? "Unknown";

  if (body.action === "dismiss") {
    const updated = await prisma.duplicateLeadFlag.update({
      where: { id: flag.id },
      data: { status: "dismissed", resolvedByName: actorName, resolvedAt: new Date() },
    });
    await logAudit({
      actorId: authUser.id,
      actorEmail: session.user?.email ?? "unknown",
      action: "duplicate_lead_dismissed",
      targetId: flag.id,
      details: `Marked as not a duplicate (leads ${flag.leadId} / ${flag.duplicateOfId})`,
    });
    return NextResponse.json(updated);
  }

  if (body.action === "merge") {
    const primaryId = body.primaryLeadId;
    if (primaryId !== flag.leadId && primaryId !== flag.duplicateOfId) {
      return NextResponse.json(
        { error: "primaryLeadId must be one of the two leads in this flag" },
        { status: 400 }
      );
    }
    const duplicateId = primaryId === flag.leadId ? flag.duplicateOfId : flag.leadId;

    const [primary, duplicate] = await Promise.all([
      prisma.lead.findUnique({ where: { id: primaryId } }),
      prisma.lead.findUnique({ where: { id: duplicateId } }),
    ]);
    if (!primary || !duplicate) {
      return NextResponse.json({ error: "One of the leads no longer exists" }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.leadNote.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } }),
      prisma.leadTimelineEvent.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } }),
      prisma.leadTag.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } }),
      prisma.opportunity.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } }),
      // Clear every flag referencing the about-to-be-removed duplicate
      // (as either side) so the FK constraint doesn't block the delete.
      prisma.duplicateLeadFlag.deleteMany({
        where: { OR: [{ leadId: duplicateId }, { duplicateOfId: duplicateId }] },
      }),
      prisma.leadTimelineEvent.create({
        data: {
          leadId: primaryId,
          type: "note",
          summary: `Merged duplicate lead "${duplicate.name}" (${duplicate.contact}) into this record — notes, timeline, tags, and opportunities moved over. Merged by ${actorName}.`,
        },
      }),
      prisma.lead.delete({ where: { id: duplicateId } }),
    ]);

    await logAudit({
      actorId: authUser.id,
      actorEmail: session.user?.email ?? "unknown",
      action: "duplicate_lead_merged",
      targetId: primaryId,
      details: `Merged "${duplicate.name}" (${duplicateId}) into "${primary.name}" (${primaryId})`,
    });

    return NextResponse.json({ ok: true, primaryLeadId: primaryId });
  }

  return NextResponse.json({ error: "action must be 'merge' or 'dismiss'" }, { status: 400 });
}
