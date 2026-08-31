import { Users, UserX, TrendingUp } from "lucide-react";
import { StatCard } from "./StatCard";
import { MostInDemandTable } from "./MostInDemandTable";
import { MonthlySalesChart } from "./MonthlySalesChart";
import { ProductivityByHourChart } from "./ProductivityByHourChart";
import { JanusEditableSlot } from "./JanusEditableSlot";
import { formatCurrency } from "@/lib/dashboardData";
import type { DashboardMetrics } from "@/lib/dashboardMetrics";

export function DashboardGrid({ metrics }: { metrics: DashboardMetrics }) {
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

        <ProductivityByHourChart data={metrics.productivityByHour} />
        <StatCard
          title="Un-contacted Leads"
          icon={UserX}
          value={metrics.uncontactedLeads.toLocaleString()}
          valueColorClass="text-status-inactive"
        />
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