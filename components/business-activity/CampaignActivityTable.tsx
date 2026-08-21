"use client";

import { useState } from "react";
import { Megaphone } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import {
  campaignActivity as initialCampaigns,
  type CampaignHealth,
} from "@/lib/businessActivityData";
import { TrendIndicator } from "./TrendIndicator";

const healthStyles: Record<CampaignHealth, string> = {
  Good: "bg-status-active/15 text-status-active",
  Satisfactory: "bg-status-alert/15 text-status-alert",
  Alert: "bg-status-inactive/15 text-status-inactive",
  Discontinued: "bg-base-700 text-ink-500",
};

export function CampaignActivityTable() {
  const [campaigns, setCampaigns] = useState(initialCampaigns);

  function toggleActive(name: string) {
    // TODO: wire to real campaign enable/disable API once campaign data
    // is sourced from Meta/Google Ads/HubSpot campaign objects.
    setCampaigns((prev) =>
      prev.map((c) => (c.name === name ? { ...c, active: !c.active } : c))
    );
  }

  return (
    <WidgetCard title="Campaign Activity" icon={Megaphone}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead>
            <tr className="text-ink-500">
              <th className="pb-2 pr-3 font-normal">Campaign</th>
              <th className="pb-2 pr-3 font-normal">Health</th>
              <th className="pb-2 pr-3 font-normal">Context</th>
              <th className="pb-2 font-normal text-right">Active</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((campaign) => (
              <tr
                key={campaign.name}
                className="border-t border-base-700 text-ink-300"
              >
                <td className="py-2 pr-3 font-medium text-ink-50">
                  {campaign.name}
                </td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-1.5">
                    <TrendIndicator direction={campaign.healthTrend} />
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${healthStyles[campaign.health]}`}
                    >
                      {campaign.health}
                    </span>
                  </div>
                </td>
                <td className="py-2 pr-3 text-ink-500">{campaign.context}</td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => toggleActive(campaign.name)}
                    aria-pressed={campaign.active}
                    aria-label={`Toggle ${campaign.name} campaign`}
                    className={`relative h-5 w-9 rounded-full transition ${
                      campaign.active ? "bg-status-active" : "bg-base-700"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${
                        campaign.active ? "left-4" : "left-0.5"
                      }`}
                    />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </WidgetCard>
  );
}
