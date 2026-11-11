import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessRecord } from "@/lib/authz";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { CALL_LIFETIME_MS, liveKitConfig, newGuestKey } from "@/lib/video/livekit";
import { joinUrl, publicOrigin } from "@/lib/video/calls";

// Start a video call (optionally for a lead). Returns the client's join
// link once: only its hash is stored, so it can't be shown again later
// (a new link can be issued from the call screen).
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!liveKitConfig()) {
        return NextResponse.json({ error: "Video calls aren't set up yet" }, { status: 503 });
      }
      const body = await request.json().catch(() => ({}));
      const leadId = typeof body.leadId === "string" ? body.leadId : null;

      let leadName: string | null = null;
      if (leadId) {
        const lead = await prisma.lead.findFirst({
          where: { id: leadId },
          select: { name: true, assignedUserId: true, assignedUser: { select: { teamId: true } } },
        });
        if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        if (!canAccessRecord(authUser, lead.assignedUserId, lead.assignedUser?.teamId ?? null)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        leadName = lead.name;
      }

      const { key, hash } = newGuestKey();
      const call = await prisma.videoCall.create({
        data: {
          roomName: `call-${randomBytes(9).toString("hex")}`,
          leadId,
          agentUserId: authUser.id,
          guestKeyHash: hash,
          expiresAt: new Date(Date.now() + CALL_LIFETIME_MS),
        },
      });

      if (leadId) {
        await prisma.leadTimelineEvent.create({
          data: {
            leadId,
            type: "video_call",
            summary: `Video call started by ${session.user?.name ?? "an agent"}`,
            occurredAt: new Date(),
          },
        });
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "video_call_started",
        targetId: call.id,
        details: leadName ? `Video call with lead ${leadName}` : "Video call (no lead)",
      });

      return NextResponse.json({ callId: call.id, joinUrl: joinUrl(publicOrigin(request), call.id, key) }, { status: 201 });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
