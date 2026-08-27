"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { formatMoney, type Tier, type AgentStatus } from "@/lib/businessActivityData";
import { SpectatePopup } from "./SpectatePopup";

export type AgentActivityRow = {
  id: string;
  name: string;
  status: AgentStatus;
  tier: Tier;
  pipelineValue: number;
  totalRevenue: number;
};

const tierStyles: Record<Tier, string> = {
  Gold: "bg-tier-gold/15 text-tier-gold",
  Silver: "bg-tier-silver/15 text-tier-silver",
  Bronze: "bg-tier-bronze/15 text-tier-bronze",
};

const statusStyles: Record<AgentStatus, string> = {
  Active: "bg-status-active/15 text-status-active",
  Inactive: "bg-status-inactive/15 text-status-inactive",
};

export function AgentActivityTable({ agents }: { agents: AgentActivityRow[] }) {
  const [spectateAgent, setSpectateAgent] = useState<string | null>(null);

  // Live-call click-to-spectate (PRD AV07) is preserved in the UI, but
  // there's currently no real per-agent live-call signal to trigger it —
  // that needs telephony presence integration. Kept disabled/unreachable
  // rather than removed, so it's ready to wire up once that exists.
  function handleSpectate() {
    console.log(`Spectating ${spectateAgent}'s call`);
    setSpectateAgent(null);
  }

  return (
    <WidgetCard title="Agent Activity" icon={Users}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-xs">
          <thead>
            <tr className="text-ink-500">
              <th className="pb-2 pr-3 font-normal">Agent</th>
              <th className="pb-2 pr-3 font-normal">Status</th>
              <th className="pb-2 pr-3 font-normal">Tier</th>
              <th className="pb-2 pr-3 font-normal text-right">Pipeline</th>
              <th className="pb-2 font-normal text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr
                key={agent.id}
                className="border-t border-base-700 text-ink-300"
              >
                <td className="py-2 pr-3 font-medium text-ink-50">
                  {agent.name}
                </td>
                <td className="py-2 pr-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusStyles[agent.status]}`}
                  >
                    {agent.status}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tierStyles[agent.tier]}`}
                  >
                    {agent.tier}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right">
                  {formatMoney(agent.pipelineValue)}
                </td>
                <td className="py-2 text-right text-ink-50">
                  {formatMoney(agent.totalRevenue)}
                </td>
              </tr>
            ))}
            {agents.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-ink-500">
                  No team members have signed in yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-ink-500">
        Status reflects recent AEX activity. Live call presence, auto-generated
        context, Productivity Index, and team hierarchy aren't connected yet —
        pipeline/revenue reflect real assigned opportunities.
      </p>

      {spectateAgent && (
        <SpectatePopup
          agentName={spectateAgent}
          clientName="Client"
          onSpectate={handleSpectate}
          onClose={() => setSpectateAgent(null)}
        />
      )}
    </WidgetCard>
  );
}