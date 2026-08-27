import type { Lead } from "@/lib/leadData";
import type { Note, TimelineEvent } from "@/lib/leadProfileData";
import {
  getQualification,
  getOpportunityDetail,
} from "@/lib/leadProfileData";
import { ProfileHeader } from "./ProfileHeader";
import { ActivityTimeline } from "./ActivityTimeline";
import { NotesSection } from "./NotesSection";
import { LeadSidePanel } from "./LeadSidePanel";
import { JanusSummaryCard } from "./JanusSummaryCard";

export function LeadProfile({
  lead,
  notes,
  timeline,
  currentUserId,
}: {
  lead: Lead;
  notes: Note[];
  timeline: TimelineEvent[];
  currentUserId: string;
}) {
  // Qualification and opportunity detail are still derived/placeholder —
  // these map to a future Opportunity entity that isn't wired to the real
  // database yet (Pipeline module still runs on lib/pipelineData.ts mock).
  const qualification = getQualification(lead);
  const opportunity = getOpportunityDetail(lead);

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