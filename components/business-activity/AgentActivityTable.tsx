"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { agentActivity, formatMoney, type Tier, type AgentStatus } from "@/lib/businessActivityData";
import { TrendIndicator } from "./TrendIndicator";
import { SpectatePopup } from "./SpectatePopup";

const tierStyles: Record<Tier, string> = {
  Gold: "bg-tier-gold/15 text-tier-gold",
  Silver: "bg-tier-silver/15 text-tier-silver",
  Bronze: "bg-tier-bronze/15 text-tier-bronze",
};

const statusStyles: Record<AgentStatus, string> = {
  Active: "bg-status-active/15 text-status-active",
  Inactive: "bg-status-inactive/15 text-status-inactive",
};

// Placeholder client names for the Spectate popup demo -- real version
// pulls the actual client on the call from the live telephony session
// (PRD AV07 -- Consultant drill down, Whisper & Live oversight).
const demoClientNames: Record<string, string> = {
  "Agent 2": "Client 02",
  "Agent 3": "Client 07",
};

export function AgentActivityTable() {
  const [spectateAgent, setSpectateAgent] = useState<string | null>(null);

  function handleRowClick(agentName: string, liveActivity: string) {
    if (liveActivity === "In call") {
      setSpectateAgent(agentName);
    }
  }

  function handleSpectate() {
    // TODO: wire to the real live-call monitoring session once telephony
    // supports manager whisper/listen-in. Requires an approved consent
    // policy per PRD 19.4 (Call and Meeting Consent).
    console.log(`Spectating ${spectateAgent}'s call`);
    setSpectateAgent(null);
  }

  return (
    <WidgetCard title="Agent Activity" icon={Users}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-xs">
          <thead>
            <tr className="text-ink-500">
              <th className="pb-2 pr-3 font-normal">Agent</th>
              <th className="pb-2 pr-3 font-normal">Status</th>
              <th className="pb-2 pr-3 font-normal">Tier</th>
              <th className="pb-2 pr-3 font-normal text-right">Pipeline</th>
              <th className="pb-2 pr-3 font-normal text-right">Revenue</th>
              <th className="pb-2 pr-3 font-normal text-right">PI</th>
              <th className="pb-2 pr-3 font-normal">Live activity</th>
              <th className="pb-2 font-normal">Team</th>
            </tr>
          </thead>
          <tbody>
            {agentActivity.map((agent) => {
              const isLiveCall = agent.liveActivity === "In call";
              return (
                <tr
                  key={agent.name}
                  onClick={() => handleRowClick(agent.name, agent.liveActivity)}
                  className={`border-t border-base-700 text-ink-300 ${
                    isLiveCall ? "cursor-pointer hover:bg-base-800" : ""
                  }`}
                  title={isLiveCall ? "Click to spectate this call" : undefined}
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
                  <td className="py-2 pr-3 text-right text-ink-50">
                    {formatMoney(agent.totalRevenue)}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {agent.pi}
                      <TrendIndicator direction={agent.liveActivityTrend} />
                    </div>
                  </td>
                  <td className="py-2 pr-3">
                    <div className={isLiveCall ? "text-status-active" : ""}>
                      {agent.liveActivity}
                    </div>
                    <div className="text-ink-500">{agent.context}</div>
                  </td>
                  <td className="py-2 text-ink-500">{agent.team}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] text-ink-500">
        Live activity and context are illustrative pending telephony/messaging
        presence and call-transcription integration. Agents shown "In call"
        can be clicked to spectate.
      </p>

      {spectateAgent && (
        <SpectatePopup
          agentName={spectateAgent}
          clientName={demoClientNames[spectateAgent] ?? "Client"}
          onSpectate={handleSpectate}
          onClose={() => setSpectateAgent(null)}
        />
      )}
    </WidgetCard>
  );
}
