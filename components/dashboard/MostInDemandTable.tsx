import { Building2 } from "lucide-react";
import { WidgetCard } from "./WidgetCard";
import { formatCurrency } from "@/lib/dashboardData";
import type { MostInDemandRow } from "@/lib/dashboardMetrics";

export function MostInDemandTable({ rows }: { rows: MostInDemandRow[] }) {
  return (
    <WidgetCard title="Most in Demand" icon={Building2}>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-ink-500">
            <th className="pb-2 pr-3 font-normal">Project / Interest</th>
            <th className="pb-2 pr-3 font-normal text-right">Interested</th>
            <th className="pb-2 font-normal text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.projectInterest}
              className="border-t border-base-700 text-ink-300"
            >
              <td className="py-2 pr-3">
                <div className="max-w-[160px] truncate" title={row.projectInterest}>
                  {row.projectInterest}
                </div>
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">{row.interested.toLocaleString("en-US")}</td>
              <td className="whitespace-nowrap py-2 text-right tabular-nums text-ink-50">
                {formatCurrency(row.totalValue)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="py-4 text-center text-ink-500">
                No opportunity interest data yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </WidgetCard>
  );
}