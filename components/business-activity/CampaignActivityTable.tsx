"use client";

import { useState } from "react";
import { Megaphone } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import type { CampaignHealth } from "@/lib/businessActivityData";
import { TrendIndicator } from "./TrendIndicator";

// Named "Campaign Activity" to match the reference UI, but we don't have
// real campaign-level data yet — we DO have real Lead.source values.
// This groups real leads by source and computes a genuine
// qualified-rate, which is a reasonable proxy for "campaign health"
// until true campaign objects (with spend, campaign IDs) are connected.
// Real sources are confirmed as Salesforce, Meta Ads, and Google Ads —
// integration is deliberately deferred until the ongoing data audit
// hands off connection details; do not wire these up before then.
// Efficiency and the on/off Status toggle are mock (no real spend/CTR
// signal exists) — the toggle is local UI state only, not persisted.
export type SourceActivityRow = {
  source: string;
  leadCount: number;
  qualifiedCount: number;
  qualifiedPercent: number;
  health: CampaignHealth;
  efficiency: number; // mock, 0-100
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

function StatusToggle({ source, discontinued }: { source: string; discontinued: boolean }) {
  const [on, setOn] = useState(!discontinued);

  return (
    <button
      type="button"
      disabled={discontinued}
      aria-label={`Toggle ${source}`}
      onClick={() => setOn((v) => !v)}
      className={`relative h-4 w-8 shrink-0 rounded-full transition ${
        discontinued
          ? "cursor-not-allowed bg-base-700"
          : on
            ? "bg-status-active"
            : "bg-base-700"
      }`}
    >
      <span
        className={`absolute top-0.5 h-3 w-3 rounded-full bg-ink-50 transition ${
          on && !discontinued ? "left-4" : "left-0.5"
        }`}
      />
    </button>
  );
}

export function CampaignActivityTable({
  sources,
}: {
  sources: SourceActivityRow[];
}) {
  return (
    <WidgetCard title="Campaign Activity" icon={Megaphone}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-xs">
          <thead>
            <tr className="text-ink-500">
              <th className="pb-2 pr-3 font-normal">Source</th>
              <th className="pb-2 pr-3 font-normal">Health</th>
              <th className="pb-2 pr-3 font-normal">Qualified rate</th>
              <th className="pb-2 pr-3 font-normal text-right">Efficiency</th>
              <th className="pb-2 font-normal text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((row) => {
              const discontinued = row.health === "Discontinued";
              return (
                <tr
                  key={row.source}
                  className={`border-t border-base-700 text-ink-300 ${discontinued ? "opacity-50" : ""}`}
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
                  <td className="py-2 pr-3 text-ink-500">
                    {row.qualifiedCount}/{row.leadCount} leads qualified (
                    {row.qualifiedPercent}%)
                  </td>
                  <td className="py-2 pr-3 text-right text-ink-50">
                    {row.efficiency}%
                  </td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end">
                      <StatusToggle source={row.source} discontinued={discontinued} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {sources.length === 0 && (
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
        Grouped by real lead source with a genuine qualified rate — true
        campaign-level data (spend, campaign IDs) isn't connected yet, so
        Efficiency and the Status toggle are illustrative rather than live
        controls.
      </p>
    </WidgetCard>
  );
}
