import { Users, UserX, DollarSign } from "lucide-react";
import { StatCard } from "./StatCard";
import { MostInDemandTable } from "./MostInDemandTable";
import { PendingTable } from "./PendingTable";
import { MonthlySalesChart } from "./MonthlySalesChart";
import { ProductivityByHourChart } from "./ProductivityByHourChart";
import { AgentActivityIndexTable } from "./AgentActivityIndexTable";
import { JanusEditableSlot } from "./JanusEditableSlot";
import { dashboardStats, formatCurrency } from "@/lib/dashboardData";

export function DashboardGrid() {
  return (
    <div className="p-6">
      <h1 className="mb-5 text-xl font-semibold text-ink-50">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <MostInDemandTable />
        <StatCard
          title="Active Leads"
          icon={Users}
          value={dashboardStats.activeLeads.toLocaleString()}
        />
        <MonthlySalesChart />

        <PendingTable />
        <StatCard
          title="Un-contacted Leads"
          icon={UserX}
          value={dashboardStats.uncontactedLeads.toLocaleString()}
          valueColorClass="text-status-inactive"
        />
        <ProductivityByHourChart />

        <AgentActivityIndexTable />
        <StatCard
          title="Average CPL"
          icon={DollarSign}
          value={formatCurrency(dashboardStats.averageCpl)}
        />
        <JanusEditableSlot />
      </div>
    </div>
  );
}
