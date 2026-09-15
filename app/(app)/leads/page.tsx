import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toUiLead } from "@/lib/leadTransform";
import { getFreshAuthUser, getLeadScopeWhere } from "@/lib/authz";
import { releaseExpiredLocks } from "@/lib/leadLocks";
import { LeadInbox } from "@/components/leads/LeadInbox";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const authUser = await getFreshAuthUser(session);

  await releaseExpiredLocks();

  const [leadRows, assignableUsers] = await Promise.all([
    prisma.lead.findMany({
      where: getLeadScopeWhere(authUser),
      orderBy: { score: "desc" },
      include: { assignedUser: true },
    }),
    // PRD AV05 — manager/admin reassignment target list. Agents don't
    // need this (they can only claim leads for themselves).
    authUser.role === "AGENT"
      ? Promise.resolve([])
      : prisma.user.findMany({
          where: {
            role: "AGENT",
            ...(authUser.role === "MANAGER" && authUser.teamId
              ? { teamId: authUser.teamId }
              : {}),
          },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
  ]);

  const leads = leadRows.map(toUiLead);

  return (
    <LeadInbox
      initialLeads={leads}
      currentUserId={authUser.id}
      isManagementView={authUser.role !== "AGENT"}
      assignableUsers={assignableUsers}
    />
  );
}