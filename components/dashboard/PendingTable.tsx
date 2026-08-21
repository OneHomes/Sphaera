import { Clock } from "lucide-react";
import { WidgetCard } from "./WidgetCard";
import { pendingItems, formatCurrency, type PriorityLevel } from "@/lib/dashboardData";

const priorityStyles: Record<PriorityLevel, string> = {
  High: "bg-status-inactive/15 text-status-inactive",
  Medium: "bg-status-alert/15 text-status-alert",
  Low: "bg-status-active/15 text-status-active",
};

export function PendingTable() {
  return (
    <WidgetCard title="Pending" icon={Clock}>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-ink-500">
            <th className="pb-2 font-normal">Name</th>
            <th className="pb-2 font-normal">Type</th>
            <th className="pb-2 font-normal">Priority</th>
            <th className="pb-2 font-normal text-right">Due</th>
          </tr>
        </thead>
        <tbody>
          {pendingItems.map((row, i) => (
            <tr
              key={`${row.name}-${i}`}
              className="border-t border-base-700 text-ink-300"
            >
              <td className="py-2">
                <div>{row.name}</div>
                <div className="text-ink-500">{formatCurrency(row.value)}</div>
              </td>
              <td className="py-2">{row.type}</td>
              <td className="py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${priorityStyles[row.priority]}`}
                >
                  {row.priority}
                </span>
              </td>
              <td className="py-2 text-right text-ink-500">{row.dueLabel}</td>
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
