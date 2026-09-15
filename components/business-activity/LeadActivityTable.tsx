import { Users2 } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import type { EngagementLevel } from "@/lib/leadData";
import { trendWord } from "@/lib/businessActivityData";
import { TrendIndicator } from "./TrendIndicator";

export type LeadActivityRow = {
  id: string;
  name: string;
  health: "up" | "down" | "flat"; // derived from score band — see page.tsx
  engagement: EngagementLevel;
  assignment: string; // real Lead.assignment status (Assigned/Locked/Unassigned)
  activity: string; // Lead.lastInteraction, already formatted
  leadOwner: string; // real Lead.assignedUser?.name
  bpm: number; // undefined PRD metric — mock, 0-100
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
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead>
            <tr className="text-ink-500">
              <th className="pb-2 pr-3 font-normal">Lead</th>
              <th className="pb-2 pr-3 font-normal">Owner</th>
              <th className="pb-2 pr-3 font-normal">Health</th>
              <th className="pb-2 pr-3 font-normal">Engagement</th>
              <th className="pb-2 pr-3 font-normal text-right">BPM</th>
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
                <td className="py-2 pr-3 text-ink-500">{lead.leadOwner}</td>
                <td className="py-2 pr-3">
                  <TrendIndicator direction={lead.health} />
                </td>
                <td className="py-2 pr-3">
                  <span className={engagementStyles[lead.engagement]}>
                    {lead.engagement}: {trendWord(lead.health)}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right text-ink-50">{lead.bpm}</td>
                <td className="py-2 pr-3 text-ink-500">{lead.activity}</td>
                <td className="py-2 text-ink-500">{lead.assignment}</td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-ink-500">
                  No leads yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-ink-500">
        Owner and Health/Engagement are real (Health is a proxy from lead
        score band, since true historical trend snapshots aren't captured
        yet). BPM is an undefined PRD metric shown for illustration only.
      </p>
    </WidgetCard>
  );
}
