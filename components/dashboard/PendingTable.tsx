import { Clock } from "lucide-react";
import { WidgetCard } from "./WidgetCard";
import { formatCurrency } from "@/lib/dashboardData";
import { PriorityBadge } from "@/components/leads/LeadBadges";
import type { PendingRow } from "@/lib/dashboardMetrics";

const barColors: Record<PendingRow["priority"], string> = {
  High: "bg-status-inactive",
  Medium: "bg-status-alert",
  Low: "bg-status-active",
};

export function PendingTable({ rows }: { rows: PendingRow[] }) {
  const counts = { High: 0, Medium: 0, Low: 0 };
  for (const r of rows) counts[r.priority] += 1;
  const total = rows.length || 1;

  return (
    <WidgetCard title="Pending" icon={Clock}>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-ink-500">
            <th className="pb-2 pr-3 font-normal">Name</th>
            <th className="pb-2 pr-3 font-normal text-right">Value</th>
            <th className="pb-2 pr-3 font-normal">Type</th>
            <th className="pb-2 pr-3 font-normal">Priority</th>
            <th className="pb-2 font-normal">Due</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-base-700 text-ink-300">
              <td className="max-w-[100px] truncate py-2 pr-3 text-ink-50">{row.name}</td>
              <td className="py-2 pr-3 text-right">{formatCurrency(row.value)}</td>
              <td className="max-w-[100px] truncate py-2 pr-3" title={row.type}>
                {row.type}
              </td>
              <td className="py-2 pr-3">
                <PriorityBadge priority={row.priority} />
              </td>
              <td
                className={`py-2 ${row.dueLabel === "Overdue" ? "text-status-inactive" : ""}`}
              >
                {row.dueLabel}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-center text-ink-500">
                Nothing pending — every open deal is on track.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {rows.length > 0 && (
        <div className="mt-3 flex h-1.5 overflow-hidden rounded-full">
          {(["High", "Medium", "Low"] as const).map((p) => (
            <span
              key={p}
              className={barColors[p]}
              style={{ width: `${(counts[p] / total) * 100}%` }}
            />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}
