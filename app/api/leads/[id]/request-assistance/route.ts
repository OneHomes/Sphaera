import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/authz";
import { createNotification } from "@/lib/notifications";
import { logAudit } from "@/lib/auditLog";

// PRD AE10/AE11 "Request manager assistance" — real notification to the
// requesting agent's manager (Team.managerId), not a live chat/whisper
// channel (that needs the telephony/websocket infra this pass doesn't
// build). The manager sees it in their existing notification bell.
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = getAuthUser(session);

  const lead = await prisma.lead.findUnique({ where: { id: params.id } });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    include: { team: true },
  });

  const managerId = user?.team?.managerId;
  if (!managerId) {
    return NextResponse.json(
      { error: "No manager is assigned to your team yet." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const note = typeof body.note === "string" ? body.note.trim() : "";

  await createNotification(
    managerId,
    "manager_assist_requested",
    `${user?.name ?? "An agent"} requested help on a call`,
    `${lead.name}${note ? ` — ${note}` : ""}`,
    `/leads/${lead.id}`
  );

  await logAudit({
    actorId: authUser.id,
    actorEmail: session.user?.email ?? "unknown",
    action: "manager_assist_requested",
    targetId: lead.id,
    details: `Requested manager assistance on a call with ${lead.name}`,
  });

  return NextResponse.json({ success: true });
}
