import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthUser, canAccessRecord } from "@/lib/authz";
import { toUiLead } from "@/lib/leadTransform";
import { CallWorkspace } from "@/components/calls/CallWorkspace";

export const dynamic = "force-dynamic";

export default async function CallWorkspacePage({
  params,
}: {
  params: { leadId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }
  const authUser = getAuthUser(session);

  const row = await prisma.lead.findUnique({
    where: { id: params.leadId },
    include: { assignedUser: true },
  });

  if (!row) {
    notFound();
  }
  if (!canAccessRecord(authUser, row.assignedUserId, row.assignedUser?.teamId ?? null)) {
    notFound();
  }

  return <CallWorkspace lead={toUiLead(row)} />;
}
