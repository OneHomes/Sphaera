import { Users, UserX, TrendingUp } from "lucide-react";
import { StatCard } from "./StatCard";
import { MostInDemandTable } from "./MostInDemandTable";
import { PendingTable } from "./PendingTable";
import { MonthlySalesChart } from "./MonthlySalesChart";
import { ProductivityByHourChart } from "./ProductivityByHourChart";
import { TeamActivityTable } from "./TeamActivityTable";
import { JanusEditableSlot } from "./JanusEditableSlot";
import { formatCurrency } from "@/lib/dashboardData";
import type { DashboardMetrics } from "@/lib/dashboardMetrics";
import type { TeamActivityRow } from "@/lib/teamActivitySnapshot";

export function DashboardGrid({
  metrics,
  teamActivity,
}: {
  metrics: DashboardMetrics;
  teamActivity: TeamActivityRow[] | null;
}) {
  return (
    <div className="p-6">
      <h1 className="mb-5 text-xl font-semibold text-ink-50">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MostInDemandTable rows={metrics.mostInDemand} />
        <StatCard
          title="Active Leads"
          icon={Users}
          value={metrics.activeLeads.toLocaleString()}
        />
        <MonthlySalesChart data={metrics.monthlySales} />

        <PendingTable rows={metrics.pending} />
        <StatCard
          title="Un-contacted Leads"
          icon={UserX}
          value={metrics.uncontactedLeads.toLocaleString()}
          valueColorClass="text-status-inactive"
        />
        <ProductivityByHourChart data={metrics.productivityByHour} />

        {teamActivity && <TeamActivityTable rows={teamActivity} />}
        <StatCard
          title="Avg Deal Size"
          icon={TrendingUp}
          value={formatCurrency(metrics.avgDealSize)}
        />
        <JanusEditableSlot />
      </div>
    </div>
  );
}
