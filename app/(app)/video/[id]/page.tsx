import { notFound } from "next/navigation";
import { VIDEO_CALLS_ENABLED, videoCallsFor } from "@/lib/video/flag";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withTenantPage } from "@/lib/withTenant";
import { AgentCall } from "@/components/video/AgentCall";
import { CallRecord } from "@/components/video/CallRecord";
import { isCallOpen } from "@/lib/video/calls";
import { viewableCall } from "@/lib/video/record";
import { readNotes } from "@/lib/video/notes";
import { recordingAccess, type RecordingAccess } from "@/lib/video/recordings";

export const dynamic = "force-dynamic";

// While the call is open this is the agent's call screen. Afterwards (and
// for their Manager or an Admin at any time) it is the call's record:
// recording, Janus's notes and the transcript.
export default async function VideoCallPage({ params }: { params: { id: string } }) {
  if (!VIDEO_CALLS_ENABLED) notFound();
  const session = await getServerSession(authOptions);
  if (!session) redirect("/sign-in");
  if (!videoCallsFor(session.user?.email)) notFound();

  return withTenantPage(session, async (authUser) => {
    const call = await viewableCall(authUser, params.id);
    if (!call) {
      return <p className="p-6 text-sm text-ink-300">This call wasn&apos;t found, or it isn&apos;t yours.</p>;
    }
    const lead = call.leadId ? await prisma.lead.findFirst({ where: { id: call.leadId }, select: { id: true, name: true } }) : null;
    if (call.agentUserId === authUser.id && isCallOpen(call)) {
      return <AgentCall callId={call.id} leadName={lead?.name ?? null} />;
    }

    const [agent, guests, recordings, transcript] = await Promise.all([
      prisma.user.findFirst({ where: { id: call.agentUserId }, select: { name: true } }),
      prisma.videoCallGuest.findMany({ where: { callId: call.id }, orderBy: { createdAt: "asc" }, select: { name: true, consentedAt: true } }),
      prisma.videoCallRecording.findMany({ where: { callId: call.id }, orderBy: { startedAt: "asc" } }),
      prisma.videoCallTranscriptSegment.findMany({
        where: { callId: call.id },
        orderBy: { spokenAt: "asc" },
        select: { id: true, speakerName: true, speakerRole: true, text: true, spokenAt: true },
      }),
    ]);

    const withAccess = await Promise.all(
      recordings.map(async (r) => {
        let access: RecordingAccess | null = null;
        if (r.status === "ready" && r.blobPath) {
          access = await recordingAccess(r.blobPath).catch(() => ({ state: "missing" }) as const);
        }
        return {
          id: r.id,
          status: r.status,
          startedAt: r.startedAt.toISOString(),
          durationSec: r.durationSec,
          sizeBytes: r.sizeBytes,
          access,
        };
      })
    );

    return (
      <CallRecord
        call={{
          id: call.id,
          open: isCallOpen(call),
          startedAt: call.createdAt.toISOString(),
          endedAt: call.endedAt?.toISOString() ?? null,
          agentName: agent?.name ?? "Agent",
          lead,
          guests: guests.map((g) => ({ name: g.name, consentedAt: g.consentedAt.toISOString() })),
          notesStatus: call.notesStatus,
          notes: readNotes(call.notes),
        }}
        recordings={withAccess}
        transcript={transcript.map((s) => ({ ...s, spokenAt: s.spokenAt.toISOString() }))}
      />
    );
  });
}
