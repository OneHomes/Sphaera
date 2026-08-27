import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toUiLead, toUiNote, toUiTimelineEvent } from "@/lib/leadTransform";
import { getAuthUser, canAccessRecord } from "@/lib/authz";
import { LeadProfile } from "@/components/leads/profile/LeadProfile";

export const dynamic = "force-dynamic";

export default async function LeadProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }
  const authUser = getAuthUser(session);

  const row = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      assignedUser: true,
      notes: { orderBy: { createdAt: "desc" } },
      timelineEvents: { orderBy: { occurredAt: "asc" } },
    },
  });

  if (!row) {
    notFound();
  }

  if (
    !canAccessRecord(
      authUser,
      row.assignedUserId,
      row.assignedUser?.teamId ?? null
    )
  ) {
    notFound(); // don't reveal existence of records outside the user's scope
  }

  const lead = toUiLead(row);
  const notes = row.notes.map(toUiNote);
  const timeline = row.timelineEvents.map(toUiTimelineEvent);

  return (
    <LeadProfile
      lead={lead}
      notes={notes}
      timeline={timeline}
      currentUserId={authUser.id}
    />
  );
}