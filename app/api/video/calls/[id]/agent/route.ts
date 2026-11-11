import { NextResponse } from "next/server";
import { VIDEO_CALLS_ENABLED } from "@/lib/video/flag";
import { prisma } from "@/lib/prisma";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { agentTokens } from "@/lib/video/livekit";
import { isCallOpen, notConfigured } from "@/lib/video/calls";

// Tokens for the agent who started the call: the call itself plus the
// listen-only coaching room (where an Admin may whisper to them).
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!VIDEO_CALLS_ENABLED) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    return await withTenant(async (authUser, session) => {
      const call = await prisma.videoCall.findFirst({ where: { id: params.id } });
      if (!call || call.agentUserId !== authUser.id) {
        return NextResponse.json({ error: "Call not found" }, { status: 404 });
      }
      if (!isCallOpen(call)) {
        return NextResponse.json({ error: "This call has ended" }, { status: 410 });
      }
      try {
        const tokens = await agentTokens(call.roomName, { id: authUser.id, name: session.user?.name ?? "Agent" });
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
