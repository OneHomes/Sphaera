import { HeartPulse } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { formatCurrency } from "@/lib/dashboardData";
import type { HealthCardStats } from "@/lib/agentPerformanceMetrics";

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-base-700 bg-base-800 p-3">
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink-50">{value}</p>
    </div>
  );
}

export function HealthCard({ stats }: { stats: HealthCardStats }) {
  return (
    <WidgetCard
      title="Health Card"
      icon={HeartPulse}
      action={
        <span className="flex items-center gap-1 text-[10px] font-medium text-status-active">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-status-active" />
          Live
        </span>
      }
      className="md:col-span-2"
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Tile label="Total Leads" value={stats.totalLeads.toLocaleString()} />
        <Tile label={`Calls (${stats.periodLabel})`} value={stats.totalCallsInPeriod.toLocaleString()} />
        <Tile label={`Meetings (${stats.periodLabel})`} value={stats.totalMeetingsInPeriod.toLocaleString()} />
        <Tile label="Pipeline Value" value={formatCurrency(stats.pipelineValue)} />
        <Tile label={`Revenue (${stats.periodLabel})`} value={formatCurrency(stats.revenueClosedInPeriod)} />
        <Tile
          label="Win Rate"
          value={stats.winRate === null ? "—" : `${stats.winRate}%`}
        />
      </div>
    </WidgetCard>
  );
}
