import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/authz";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { monitorTokens } from "@/lib/video/livekit";
import { isCallOpen, notConfigured } from "@/lib/video/calls";

// Admin: watch a call unseen (hidden, subscribe-only) and, optionally,
// speak to the agent through the coaching room. Every monitoring session
// is written to the audit log.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!hasRole(authUser, ["ADMIN"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      const call = await prisma.videoCall.findFirst({ where: { id: params.id } });
      if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });
      if (!isCallOpen(call)) return NextResponse.json({ error: "This call has ended" }, { status: 410 });
      try {
        const tokens = await monitorTokens(call.roomName, { id: authUser.id, name: session.user?.name ?? "Admin" });
        await logAudit({
          actorId: authUser.id,
          actorEmail: session.user?.email ?? "unknown",
          action: "video_call_monitored",
          targetId: call.id,
          details: "Admin joined the call as a hidden monitor (can coach the agent)",
        });
        return NextResponse.json(tokens);
      } catch (err) {
        const res = notConfigured(err);
        if (res) return res;
        throw err;
      }
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
