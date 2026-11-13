import { NextResponse } from "next/server";
import { VIDEO_CALLS_ENABLED, videoCallsFor } from "@/lib/video/flag";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { newGuestKey } from "@/lib/video/livekit";
import { isCallOpen, joinUrl, publicOrigin } from "@/lib/video/calls";

// Issue a fresh client link for the agent's call. Only the hash of a link
// is stored, so a lost link can't be shown again; the previous link stops
// working once this one is issued.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!VIDEO_CALLS_ENABLED) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    return await withTenant(async (authUser, session) => {
      if (!videoCallsFor(session.user?.email)) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const call = await prisma.videoCall.findFirst({ where: { id: params.id } });
      if (!call || call.agentUserId !== authUser.id) {
        return NextResponse.json({ error: "Call not found" }, { status: 404 });
      }
      if (!isCallOpen(call)) {
        return NextResponse.json({ error: "This call has ended" }, { status: 410 });
      }
      const { key, hash } = newGuestKey();
      await prisma.videoCall.update({ where: { id: call.id }, data: { guestKeyHash: hash } });
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "video_call_link_reissued",
        targetId: call.id,
        details: "New client join link issued; the previous link no longer works",
      });
      return NextResponse.json({ joinUrl: joinUrl(publicOrigin(request), call.id, key) });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
