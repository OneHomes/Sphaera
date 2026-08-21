import type { Lead } from "@/lib/leadData";
import {
  getTimelineForLead,
  getQualification,
  getOpportunityDetail,
  getInitialNotes,
} from "@/lib/leadProfileData";
import { ProfileHeader } from "./ProfileHeader";
import { ActivityTimeline } from "./ActivityTimeline";
import { NotesSection } from "./NotesSection";
import { LeadSidePanel } from "./LeadSidePanel";
import { JanusSummaryCard } from "./JanusSummaryCard";

export function LeadProfile({ lead }: { lead: Lead }) {
  const timeline = getTimelineForLead(lead);
  const qualification = getQualification(lead);
  const opportunity = getOpportunityDetail(lead);
  const notes = getInitialNotes(lead);

  return (
    <div className="flex h-full flex-col">
      <ProfileHeader lead={lead} />

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <ActivityTimeline events={timeline} />
            <NotesSection initialNotes={notes} />
          </div>

          <div className="space-y-4">
            <JanusSummaryCard lead={lead} />
            <LeadSidePanel
              lead={lead}
              qualification={qualification}
              opportunity={opportunity}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
