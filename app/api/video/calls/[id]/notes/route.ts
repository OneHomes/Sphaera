import { NextResponse } from "next/server";
import { VIDEO_CALLS_ENABLED, videoCallsFor } from "@/lib/video/flag";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { viewableCall } from "@/lib/video/record";
import { generateCallNotes } from "@/lib/video/notes";

export const maxDuration = 60;

// Write the call's notes again from its transcript (e.g. after a failure).
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  if (!VIDEO_CALLS_ENABLED) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    return await withTenant(async (authUser, session) => {
      if (!videoCallsFor(session.user?.email)) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const call = await viewableCall(authUser, params.id);
      if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });
      if (call.status !== "ended") return NextResponse.json({ error: "Notes are written once the call ends" }, { status: 409 });

      await generateCallNotes(call.id, { force: true });
      const after = await prisma.videoCall.findFirst({ where: { id: call.id }, select: { notesStatus: true } });
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "video_call_notes_regenerated",
        targetId: call.id,
        details: `Call notes rewritten (${after?.notesStatus ?? "unknown"})`,
      });
      return NextResponse.json({ notesStatus: after?.notesStatus ?? null });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
