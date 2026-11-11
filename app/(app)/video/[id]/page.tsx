import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withTenantPage } from "@/lib/withTenant";
import { AgentCall } from "@/components/video/AgentCall";

export const dynamic = "force-dynamic";

// The agent's screen for a call they started.
export default async function VideoCallPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/sign-in");

  return withTenantPage(session, async (authUser) => {
    const call = await prisma.videoCall.findFirst({ where: { id: params.id } });
    if (!call || call.agentUserId !== authUser.id) {
      return <p className="p-6 text-sm text-ink-300">This call wasn&apos;t found, or it isn&apos;t yours.</p>;
    }
    const lead = call.leadId ? await prisma.lead.findFirst({ where: { id: call.leadId }, select: { name: true } }) : null;
    return <AgentCall callId={call.id} leadName={lead?.name ?? null} />;
  });
}
