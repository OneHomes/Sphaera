import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/authz";
import { toUiLead } from "@/lib/leadTransform";
import { TERMINAL_LEAD_STAGES } from "@/lib/leadData";
import { CallsHub } from "@/components/calls/CallsHub";

export const dynamic = "force-dynamic";

// PRD AE11 (Call Workspace). The nav item pointing here already existed
// ("Calls & Deals") but had no page behind it. This is the real entry
// point: the agent's own open leads, ordered by score, each with a
// "Start Call" link into /calls/[leadId].
export default async function CallsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }
  const authUser = getAuthUser(session);

  const leadRows = await prisma.lead.findMany({
    where: {
      assignedUserId: authUser.id,
      stage: { notIn: TERMINAL_LEAD_STAGES },
    },
    orderBy: { score: "desc" },
    include: { assignedUser: true },
  });

  const leads = leadRows.map(toUiLead);

  return <CallsHub leads={leads} />;
}
