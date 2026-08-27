import { Users2 } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import type { EngagementLevel } from "@/lib/leadData";
import { TrendIndicator } from "./TrendIndicator";

export type LeadActivityRow = {
  id: string;
  name: string;
  health: "up" | "down" | "flat"; // derived from score band — see page.tsx
  engagement: EngagementLevel;
  assignment: string; // real Lead.assignment status (Assigned/Locked/Unassigned)
  activity: string; // Lead.lastInteraction, already formatted
};

const engagementStyles: Record<EngagementLevel, string> = {
  High: "text-status-active",
  Medium: "text-status-alert",
  Low: "text-status-inactive",
};

export function LeadActivityTable({ leads }: { leads: LeadActivityRow[] }) {
  return (
    <WidgetCard title="Lead Activity" icon={Users2}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[440px] text-left text-xs">
          <thead>
            <tr className="text-ink-500">
              <th className="pb-2 pr-3 font-normal">Lead</th>
              <th className="pb-2 pr-3 font-normal">Health</th>
              <th className="pb-2 pr-3 font-normal">Engagement</th>
              <th className="pb-2 pr-3 font-normal">Activity</th>
              <th className="pb-2 font-normal">Assignment</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                className="border-t border-base-700 text-ink-300"
              >
                <td className="py-2 pr-3 font-medium text-ink-50">
                  {lead.name}
                </td>
                <td className="py-2 pr-3">
                  <TrendIndicator direction={lead.health} />
                </td>
                <td className="py-2 pr-3">
                  <span className={engagementStyles[lead.engagement]}>
                    {lead.engagement}
                  </span>
                </td>
                <td className="py-2 pr-3 text-ink-500">{lead.activity}</td>
                <td className="py-2 text-ink-500">{lead.assignment}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-ink-500">
                  No leads yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-ink-500">
        Health is derived from lead score (Hot/Warm/Cool → up/flat/down) as
        a proxy — a true trend needs historical score snapshots, which
        aren't captured yet. BPM (an undefined PRD metric) and per-lead
        owner names aren't shown for the same reason as before.
      </p>
    </WidgetCard>
  );
}