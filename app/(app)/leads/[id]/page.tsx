import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRelativeTime, toUiLead, toUiNote, toUiTimelineEvent } from "@/lib/leadTransform";
import { canAccessRecord } from "@/lib/authz";
import { withTenantPage } from "@/lib/withTenant";
import { getNextBestAction } from "@/lib/nextBestAction";
import { originalSourceLabel } from "@/lib/leadOriginalSource";
import { LeadProfile } from "@/components/leads/profile/LeadProfile";
import { videoCallsFor } from "@/lib/video/flag";

export const dynamic = "force-dynamic";

// First line matches HubSpot's own "Created" entry (its Original Source);
// the team-entered Lead Source follows, since that's what filters use.
function createdSummary(row: {
  hubspotId: string | null;
  source: string;
  originalSource: string | null;
  originalSourceDetail: string | null;
}): string {
  const origin = originalSourceLabel(row.originalSource, row.originalSourceDetail);
  if (origin) return `This contact was created from ${origin}\nLead Source: ${row.source}`;
  return `This lead was created${row.hubspotId ? " in HubSpot" : " in Sphaera"}\nLead Source: ${row.source}`;
}

export default async function LeadProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async (authUser) => {
    const row = await prisma.lead.findUnique({
      where: { id: params.id },
      include: {
        assignedUser: true,
        notes: { orderBy: { createdAt: "desc" } },
        // Newest first — a lead can have well over a thousand imported
        // HubSpot events (old email threads etc.), and the most useful
        // thing to see first opening a profile is what happened most
        // recently, not the oldest history.
        timelineEvents: { orderBy: { occurredAt: "desc" } },
      },
    });

    if (!row) {
      notFound();
    }

    if (
      !canAccessRecord(
        authUser,
        row.assignedUserId,
        row.assignedUser?.teamId ?? null,
      )
    ) {
      notFound(); // don't reveal existence of records outside the user's scope
    }

    // PRD AE09 (Lead 360) — real linked Opportunity and real reference
    // documents for this lead's project, consolidated alongside its
    // notes/timeline into one profile. Previously the "Opportunity &
    // negotiation" card showed numbers derived from a formula on
    // lead.score, not real data — now it's the actual linked Opportunity,
    // or an honest empty state if none exists yet.
    const [opportunity, relatedDocuments] = await Promise.all([
      prisma.opportunity.findFirst({ where: { leadId: row.id } }),
      prisma.document.findMany({
        where: { relatedTo: row.projectInterest },
        include: { uploadedBy: { select: { name: true } } },
        take: 10,
      }),
    ]);

    const lead = toUiLead(row);
    const notes = row.notes.map(toUiNote);
    // HubSpot shows a "Created" entry at the bottom of every contact's
    // timeline; there's no stored event for it here, so it's added from
    // Lead.createdAt (already HubSpot's createdate for imported leads).
    // Appended last because the list is newest-first.
    const timeline = [
      ...row.timelineEvents.map(toUiTimelineEvent),
      {
        id: `created-${row.id}`,
        type: "created" as const,
        timestamp: formatRelativeTime(row.createdAt),
        occurredAt: row.createdAt.toISOString(),
        summary: createdSummary(row),
      },
    ];
    const nextBestAction = getNextBestAction(row, row.timelineEvents);

    return (
      <LeadProfile
        lead={lead}
        notes={notes}
        timeline={timeline}
        currentUserId={authUser.id}
        videoCalls={videoCallsFor(session.user?.email)}
        nextBestAction={nextBestAction}
        opportunity={
          opportunity
            ? {
                value: opportunity.value,
                probability: opportunity.probability,
                stage: opportunity.stage,
                expectedCloseAt:
                  opportunity.expectedCloseAt?.toISOString() ?? null,
              }
            : null
        }
        relatedDocuments={relatedDocuments.map((d) => ({
          id: d.id,
          name: d.name,
          docType: d.docType,
          uploadedByName: d.uploadedBy.name,
        }))}
      />
    );
  });
}
