import type { Lead } from "@/lib/leadData";
import type { Note, TimelineEvent } from "@/lib/leadProfileData";
import type { NextBestAction } from "@/lib/nextBestAction";
import { getQualification } from "@/lib/leadProfileData";
import { ProfileHeader } from "./ProfileHeader";
import { ActivityTimeline } from "./ActivityTimeline";
import { NotesSection } from "./NotesSection";
import { LeadSidePanel, type RealOpportunity, type RelatedDocument } from "./LeadSidePanel";
import { JanusSummaryCard } from "./JanusSummaryCard";
import { NextBestActionCard } from "./NextBestActionCard";

export function LeadProfile({
  lead,
  notes,
  timeline,
  currentUserId,
  nextBestAction,
  opportunity,
  relatedDocuments,
}: {
  lead: Lead;
  notes: Note[];
  timeline: TimelineEvent[];
  currentUserId: string;
  nextBestAction: NextBestAction;
  opportunity: RealOpportunity | null;
  relatedDocuments: RelatedDocument[];
}) {
  // Qualification (budget/bedrooms/move-in/financing) has no real Lead
  // field to source it from yet — kept as an explicitly-labelled
  // heuristic estimate (see LeadSidePanel's footnote) rather than
  // removed, since it's still a useful starting read for the agent.
  // Opportunity is now real (see leads/[id]/page.tsx) — no longer derived.
  const qualification = getQualification(lead);

  return (
    <div className="flex h-full flex-col">
      <ProfileHeader lead={lead} currentUserId={currentUserId} />

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <ActivityTimeline events={timeline} />
            <NotesSection leadId={lead.id} initialNotes={notes} />
          </div>

          <div className="space-y-4">
            <NextBestActionCard leadId={lead.id} nba={nextBestAction} />
            <JanusSummaryCard lead={lead} />
            <LeadSidePanel
              lead={lead}
              qualification={qualification}
              opportunity={opportunity}
              relatedDocuments={relatedDocuments}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
