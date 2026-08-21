import { UserCheck } from "lucide-react";
import { WidgetCard } from "./WidgetCard";
import { agentActivityIndex, type AgentStatus } from "@/lib/dashboardData";

const statusStyles: Record<AgentStatus, string> = {
  "Optimal Activity": "bg-status-active/15 text-status-active",
  "Moderate Activity": "bg-status-alert/15 text-status-alert",
  "Minimal Activity": "bg-status-inactive/15 text-status-inactive",
};

export function AgentActivityIndexTable() {
  return (
    <WidgetCard title="Agent Activity Index" icon={UserCheck}>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-ink-500">
            <th className="pb-2 font-normal">Name</th>
            <th className="pb-2 font-normal">Extension</th>
            <th className="pb-2 font-normal">Status Now</th>
            <th className="pb-2 font-normal text-right">Score</th>
          </tr>
        </thead>
        <tbody>
          {agentActivityIndex.map((row, i) => (
            <tr
              key={`${row.email}-${i}`}
              className="border-t border-base-700 text-ink-300"
            >
              <td className="py-2">
                <div className="text-ink-50">{row.name}</div>
                <div className="text-ink-500">{row.email}</div>
              </td>
              <td className="py-2">{row.extension}</td>
              <td className="py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusStyles[row.status]}`}
                >
                  {row.status}
                </span>
              </td>
              <td className="py-2 text-right text-ink-50">
                {row.productivityScore}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="mt-2 text-xs text-ink-500 hover:text-ink-300">
        View all
      </button>
    </WidgetCard>
  );
}
