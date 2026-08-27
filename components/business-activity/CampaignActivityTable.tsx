import { Megaphone } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import type { CampaignHealth } from "@/lib/businessActivityData";
import { TrendIndicator } from "./TrendIndicator";

// Renamed in spirit from "Campaign Activity" to lead-source activity —
// we don't have real campaign-level data (no Meta/Google Ads campaign
// sync yet), but we DO have real Lead.source values. This groups real
// leads by source and computes a genuine qualified-rate, which is a
// reasonable proxy for "campaign health" until true campaign objects
// (with spend, campaign IDs) are connected per the Fabric audit.
export type SourceActivityRow = {
  source: string;
  leadCount: number;
  qualifiedCount: number;
  qualifiedPercent: number;
  health: CampaignHealth;
};

const healthStyles: Record<CampaignHealth, string> = {
  Good: "bg-status-active/15 text-status-active",
  Satisfactory: "bg-status-alert/15 text-status-alert",
  Alert: "bg-status-inactive/15 text-status-inactive",
  Discontinued: "bg-base-700 text-ink-500",
};

const healthTrend: Record<CampaignHealth, "up" | "down" | "flat"> = {
  Good: "up",
  Satisfactory: "flat",
  Alert: "down",
  Discontinued: "flat",
};

export function CampaignActivityTable({
  sources,
}: {
  sources: SourceActivityRow[];
}) {
  return (
    <WidgetCard title="Lead Source Activity" icon={Megaphone}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-xs">
          <thead>
            <tr className="text-ink-500">
              <th className="pb-2 pr-3 font-normal">Source</th>
              <th className="pb-2 pr-3 font-normal">Health</th>
              <th className="pb-2 font-normal">Qualified rate</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((row) => (
              <tr
                key={row.source}
                className="border-t border-base-700 text-ink-300"
              >
                <td className="py-2 pr-3 font-medium text-ink-50">
                  {row.source}
                </td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-1.5">
                    <TrendIndicator direction={healthTrend[row.health]} />
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${healthStyles[row.health]}`}
                    >
                      {row.health}
                    </span>
                  </div>
                </td>
                <td className="py-2 text-ink-500">
                  {row.qualifiedCount}/{row.leadCount} leads qualified (
                  {row.qualifiedPercent}%)
                </td>
              </tr>
            ))}
            {sources.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-ink-500">
                  No leads yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-ink-500">
        Grouped by real lead source — true campaign-level data (spend,
        campaign IDs) isn't connected yet, so this reflects source-level
        performance rather than individual ad campaigns.
      </p>
    </WidgetCard>
  );
}