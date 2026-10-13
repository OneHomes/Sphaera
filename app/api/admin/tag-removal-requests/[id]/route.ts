import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFreshAuthUser, hasRole } from "@/lib/authz";
import { logAudit } from "@/lib/auditLog";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await getFreshAuthUser(session);
  if (!hasRole(authUser, ["ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const removalRequest = await prisma.tagRemovalRequest.findUnique({
    where: { id: params.id },
    include: { leadTag: true },
  });
  if (!removalRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  if (removalRequest.status !== "pending") {
    return NextResponse.json({ error: `This request is already ${removalRequest.status}` }, { status: 409 });
  }

  const body = await request.json();
  if (body.action !== "approve" && body.action !== "deny") {
    return NextResponse.json({ error: "action must be 'approve' or 'deny'" }, { status: 400 });
  }

  const resolvedByName = session.user?.name ?? session.user?.email ?? "Unknown";

  await prisma.$transaction([
    prisma.tagRemovalRequest.update({
      where: { id: params.id },
      data: { status: body.action === "approve" ? "approved" : "denied", resolvedByName, resolvedAt: new Date() },
    }),
    ...(body.action === "approve"
      ? [
          prisma.leadTag.update({
            where: { id: removalRequest.leadTagId },
            data: { removedAt: new Date(), removedByName: resolvedByName },
          }),
        ]
      : []),
  ]);

  await logAudit({
    actorId: authUser.id,
    actorEmail: session.user?.email ?? "unknown",
    action: body.action === "approve" ? "tag_removal_approved" : "tag_removal_denied",
    targetId: removalRequest.leadTagId,
    details: `${body.action === "approve" ? "Approved" : "Denied"} removal of tag "${removalRequest.leadTag.tag}" (requested by ${removalRequest.requestedByName}: "${removalRequest.reason}")`,
  });

  return NextResponse.json({ ok: true });
}
