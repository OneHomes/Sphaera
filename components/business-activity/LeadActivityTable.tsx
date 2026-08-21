import { Users2 } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { leadActivity } from "@/lib/businessActivityData";
import { TrendIndicator } from "./TrendIndicator";

const interestCategoryStyles: Record<string, string> = {
  High: "text-status-active",
  Good: "text-status-alert",
  Low: "text-status-inactive",
};

export function LeadActivityTable() {
  return (
    <WidgetCard title="Lead Activity" icon={Users2}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-xs">
          <thead>
            <tr className="text-ink-500">
              <th className="pb-2 pr-3 font-normal">Lead</th>
              <th className="pb-2 pr-3 font-normal">Health</th>
              <th className="pb-2 pr-3 font-normal">Interest level</th>
              <th className="pb-2 pr-3 font-normal text-right">BPM</th>
              <th className="pb-2 pr-3 font-normal">Activity</th>
              <th className="pb-2 font-normal">Owner</th>
            </tr>
          </thead>
          <tbody>
            {leadActivity.map((lead) => (
              <tr
                key={lead.name}
                className="border-t border-base-700 text-ink-300"
              >
                <td className="py-2 pr-3 font-medium text-ink-50">
                  {lead.name}
                </td>
                <td className="py-2 pr-3">
                  <TrendIndicator direction={lead.health} />
                </td>
                <td className="py-2 pr-3">
                  <span
                    className={interestCategoryStyles[lead.interestCategory]}
                  >
                    {lead.interestCategory}
                  </span>
                  <span className="text-ink-500">
                    ; {lead.interestTrend}
                  </span>
                </td>
                <td
                  className="py-2 pr-3 text-right text-ink-50"
                  title="BPM definition pending business clarification — placeholder value"
                >
                  {lead.bpm}
                </td>
                <td className="py-2 pr-3 text-ink-500">{lead.activity}</td>
                <td className="py-2 text-ink-500">{lead.leadOwner}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-ink-500">
        BPM is an undefined metric in the current spec — shown as a
        placeholder pending a business definition.
      </p>
    </WidgetCard>
  );
}
