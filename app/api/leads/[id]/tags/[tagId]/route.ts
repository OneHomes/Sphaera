import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

// Per the boss's direct request (2026-10-13 call) — a tag is never
// removed instantly. The requester must give a reason, which creates a
// pending TagRemovalRequest and notifies every Admin; only an Admin
// approval (see app/api/admin/tag-removal-requests/[id]/route.ts)
// actually soft-deletes the LeadTag. The tag stays visible (marked
// "removal requested") until resolved.
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; tagId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json({ error: "A reason is required to request tag removal" }, { status: 400 });
  }

  const tag = await prisma.leadTag.findUnique({ where: { id: params.tagId } });
  if (!tag || tag.leadId !== params.id) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }
  if (tag.removedAt) {
    return NextResponse.json({ error: "Tag already removed" }, { status: 409 });
  }

  const existingPending = await prisma.tagRemovalRequest.findFirst({
    where: { leadTagId: params.tagId, status: "pending" },
  });
  if (existingPending) {
    return NextResponse.json({ error: "A removal request for this tag is already pending" }, { status: 409 });
  }

  const requestedByName = session.user?.name ?? session.user?.email ?? "Unknown";
  const removalRequest = await prisma.tagRemovalRequest.create({
    data: { leadTagId: params.tagId, reason, requestedByName },
  });

  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await Promise.all(
    admins.map((admin) =>
      createNotification(
        admin.id,
        "tag_removal_requested",
        `${requestedByName} wants to remove tag ${tag.tag}`,
        reason,
        `/leads/${params.id}`
      )
    )
  );

  return NextResponse.json({ ok: true, requestId: removalRequest.id }, { status: 202 });
}
