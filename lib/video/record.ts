import { prisma } from "@/lib/prisma";
import { canAccessRecord, type AuthUser } from "@/lib/authz";

// Who may open a call's record (recording, transcript, notes): the agent
// who held the call, their team's Manager, and Admins — the same rule as
// the lead itself.
export async function viewableCall(authUser: AuthUser, callId: string) {
  const call = await prisma.videoCall.findFirst({ where: { id: callId } });
  if (!call) return null;
  if (call.agentUserId === authUser.id) return call;
  const agent = await prisma.user.findFirst({ where: { id: call.agentUserId }, select: { teamId: true } });
  return canAccessRecord(authUser, call.agentUserId, agent?.teamId ?? null) ? call : null;
}
