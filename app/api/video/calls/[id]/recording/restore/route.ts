import { NextResponse } from "next/server";
import { VIDEO_CALLS_ENABLED, videoCallsFor } from "@/lib/video/flag";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
import { viewableCall } from "@/lib/video/record";
import { restoreRecording } from "@/lib/video/recordings";

// Ask Azure to bring an archived recording back so it can be played.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!VIDEO_CALLS_ENABLED) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    return await withTenant(async (authUser, session) => {
      if (!videoCallsFor(session.user?.email)) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const call = await viewableCall(authUser, params.id);
      if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });
      const body = await request.json().catch(() => ({}));
      const recording = await prisma.videoCallRecording.findFirst({
        where: { callId: call.id, id: typeof body.recordingId === "string" ? body.recordingId : undefined },
      });
      if (!recording?.blobPath) return NextResponse.json({ error: "Recording not found" }, { status: 404 });

      await restoreRecording(recording.blobPath);
      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "video_recording_restore_requested",
        targetId: call.id,
        details: `Restore requested for ${recording.blobPath}`,
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
