import { AgentActivityTable, type AgentActivityRow } from "./AgentActivityTable";
import { CampaignActivityTable, type SourceActivityRow } from "./CampaignActivityTable";
import { MiniCalendar } from "./MiniCalendar";
import { LeadActivityTable, type LeadActivityRow } from "./LeadActivityTable";

export function BusinessActivityGrid({
  agents,
  sources,
  leads,
}: {
  agents: AgentActivityRow[];
  sources: SourceActivityRow[];
  leads: LeadActivityRow[];
}) {
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-ink-50">
        Business Activity
      </h1>
      <p className="mb-5 text-sm text-ink-500">
        Live view of agent, lead-source, and lead activity across the team.
      </p>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <AgentActivityTable agents={agents} />
        <CampaignActivityTable sources={sources} />
        <MiniCalendar />
        <LeadActivityTable leads={leads} />
      </div>
    </div>
  );
}