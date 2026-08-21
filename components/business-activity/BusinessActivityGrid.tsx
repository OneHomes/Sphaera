import { AgentActivityTable } from "./AgentActivityTable";
import { CampaignActivityTable } from "./CampaignActivityTable";
import { MiniCalendar } from "./MiniCalendar";
import { LeadActivityTable } from "./LeadActivityTable";

export function BusinessActivityGrid() {
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-ink-50">
        Business Activity
      </h1>
      <p className="mb-5 text-sm text-ink-500">
        Live view of agent, campaign, and lead activity across the team.
      </p>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <AgentActivityTable />
        <CampaignActivityTable />
        <MiniCalendar />
        <LeadActivityTable />
      </div>
    </div>
  );
}
