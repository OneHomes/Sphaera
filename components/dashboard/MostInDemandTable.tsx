import { Flame } from "lucide-react";
import { WidgetCard } from "./WidgetCard";
import { mostInDemand, formatCurrency } from "@/lib/dashboardData";

export function MostInDemandTable() {
  return (
    <WidgetCard title="Most in demand" icon={Flame}>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-ink-500">
            <th className="pb-2 font-normal">Unit No.</th>
            <th className="pb-2 font-normal">Type</th>
            <th className="pb-2 font-normal text-right">Interested</th>
            <th className="pb-2 font-normal text-right">Value</th>
          </tr>
        </thead>
        <tbody>
          {mostInDemand.map((row) => (
            <tr
              key={row.unitNo}
              className="border-t border-base-700 text-ink-300"
            >
              <td className="py-2 text-status-active">{row.unitNo}</td>
              <td className="py-2">{row.type}</td>
              <td className="py-2 text-right">{row.interested}</td>
              <td className="py-2 text-right text-ink-50">
                {formatCurrency(row.value)}
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
