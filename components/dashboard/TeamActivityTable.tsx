import Link from "next/link";
import { Users } from "lucide-react";
import { WidgetCard } from "./WidgetCard";
import type { TeamActivityRow } from "@/lib/teamActivitySnapshot";

export function TeamActivityTable({ rows }: { rows: TeamActivityRow[] }) {
  return (
    <WidgetCard title="Agent Activity Index" icon={Users}>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-ink-500">
            <th className="pb-2 pr-3 font-normal">Name</th>
            <th className="pb-2 pr-3 font-normal">Email</th>
            <th className="pb-2 pr-3 font-normal">Status</th>
            <th className="pb-2 font-normal text-right">Productivity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-base-700 text-ink-300">
              <td className="max-w-[90px] truncate py-2 pr-3 text-ink-50">{row.name}</td>
              <td className="max-w-[120px] truncate py-2 pr-3">{row.email}</td>
              <td className="py-2 pr-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    row.isActive
                      ? "bg-status-active/15 text-status-active"
                      : "bg-status-alert/15 text-status-alert"
                  }`}
                >
                  {row.isActive ? "Active" : "Idle"}
                </span>
              </td>
              <td className="py-2 text-right text-ink-50">{row.productivityIndex}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-ink-500">
                No team members yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <Link
        href="/business-activity"
        className="mt-2 block text-center text-[11px] text-ink-500 hover:text-ink-300"
      >
        View all
      </Link>
    </WidgetCard>
  );
}
