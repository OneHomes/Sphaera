import { NextResponse } from "next/server";
import { VIDEO_CALLS_ENABLED } from "@/lib/video/flag";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/authz";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { coachRoomName, liveKitConfig, roomService } from "@/lib/video/livekit";

// End a call for everyone (the agent who started it, or an Admin): the
// link stops working and both LiveKit rooms are closed.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  if (!VIDEO_CALLS_ENABLED) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    return await withTenant(async (authUser, session) => {
      const call = await prisma.videoCall.findFirst({ where: { id: params.id } });
      if (!call || (call.agentUserId !== authUser.id && !hasRole(authUser, ["ADMIN"]))) {
        return NextResponse.json({ error: "Call not found" }, { status: 404 });
      }
      if (call.status !== "ended") {
        await prisma.videoCall.update({ where: { id: call.id }, data: { status: "ended", endedAt: new Date() } });
      }
      if (liveKitConfig()) {
        const rooms = roomService();
        // A room that never started (or already closed) isn't an error here.
        await Promise.allSettled([rooms.deleteRoom(call.roomName), rooms.deleteRoom(coachRoomName(call.roomName))]);
      }
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "video_call_ended",
        targetId: call.id,
        details: "Video call ended",
      });
      return NextResponse.json({ ok: true });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
