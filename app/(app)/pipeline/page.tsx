import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toUiOpportunity } from "@/lib/opportunityTransform";
import { getAuthUser, getOpportunityScopeWhere } from "@/lib/authz";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const authUser = getAuthUser(session);

  const rows = await prisma.opportunity.findMany({
    where: getOpportunityScopeWhere(authUser),
    orderBy: { value: "desc" },
    include: { assignedUser: true },
  });

  const opportunities = rows.map(toUiOpportunity);

  return (
    <PipelineBoard
      initialOpportunities={opportunities}
      currentUserId={authUser.id}
    />
  );
}