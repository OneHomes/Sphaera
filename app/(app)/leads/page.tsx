import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toUiLead } from "@/lib/leadTransform";
import { getAuthUser, getLeadScopeWhere } from "@/lib/authz";
import { LeadInbox } from "@/components/leads/LeadInbox";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const authUser = getAuthUser(session);

  const leadRows = await prisma.lead.findMany({
    where: getLeadScopeWhere(authUser),
    orderBy: { score: "desc" },
    include: { assignedUser: true },
  });

  const leads = leadRows.map(toUiLead);

  return <LeadInbox initialLeads={leads} currentUserId={authUser.id} />;
}