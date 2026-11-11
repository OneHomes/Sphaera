import { prisma } from "@/lib/prisma";
import { guestKeyMatches } from "@/lib/video/livekit";
import { isCallOpen } from "@/lib/video/calls";
import { GuestJoin } from "@/components/video/GuestJoin";

export const dynamic = "force-dynamic";

// Public join page for a client (no Sphaera account). The link carries the
// call id and a secret; nothing about the call or lead is shown unless the
// secret matches.
export default async function MeetPage({ params, searchParams }: { params: { id: string }; searchParams: { k?: string } }) {
  const key = typeof searchParams.k === "string" ? searchParams.k : "";
  const call = key ? await prisma.videoCall.findUnique({ where: { id: params.id } }) : null;

  if (!call || !guestKeyMatches(key, call.guestKeyHash)) {
    return <Notice title="This link isn't valid" body="Ask the person who sent it for a new link." />;
  }
  if (!isCallOpen(call)) {
    return <Notice title="This call has ended" body="Ask the person who sent the link if you need to talk again." />;
  }

  const [agent, org] = await Promise.all([
    prisma.user.findUnique({ where: { id: call.agentUserId }, select: { name: true } }),
    call.organizationId
      ? prisma.organization.findUnique({ where: { id: call.organizationId }, select: { name: true } })
      : null,
  ]);

  return <GuestJoin callId={call.id} joinKey={key} agentName={agent?.name ?? "your advisor"} orgName={org?.name ?? "Sphaera"} />;
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-xl font-semibold text-ink-50">{title}</h1>
        <p className="mt-2 text-sm text-ink-300">{body}</p>
      </div>
    </main>
  );
}
