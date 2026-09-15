import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { getAgentPerformanceMetrics, type PerformancePeriod } from "@/lib/agentPerformanceMetrics";
import { getDashboardMetrics } from "@/lib/dashboardMetrics";
import { HealthCard } from "@/components/performance/HealthCard";
import { WeeklyTargetGauge } from "@/components/performance/WeeklyTargetGauge";
import { TierStatusPanel } from "@/components/performance/TierStatusPanel";
import { MonthlySalesBreakdownChart } from "@/components/performance/MonthlySalesBreakdownChart";
import { PipelineByHourChart } from "@/components/performance/PipelineByHourChart";
import { ProductivityByHourChart } from "@/components/dashboard/ProductivityByHourChart";
import { ProductivityIndexCard } from "@/components/aex/ProductivityIndexCard";
import { PeriodToggle } from "@/components/performance/PeriodToggle";

export const dynamic = "force-dynamic";

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const period: PerformancePeriod = searchParams.period === "week" ? "week" : "month";

  const user = await getOrCreateCurrentUser(session);
  const [metrics, dashboardMetrics] = await Promise.all([
    getAgentPerformanceMetrics(user.id, user.teamId, period),
    getDashboardMetrics(user.id),
  ]);

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mb-1 text-xl font-semibold text-ink-50">Agent Activity</h1>
          <p className="text-sm text-ink-500">
            Your personal performance: targets, tier progress, and pipeline activity.
          </p>
        </div>
        <PeriodToggle current={period} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <HealthCard stats={metrics.health} />
        <TierStatusPanel tier={metrics.tier} targets={metrics.targets} />
        <ProductivityIndexCard />

        {metrics.targets.map((target) => (
          <WeeklyTargetGauge key={target.id} target={target} />
        ))}

        <MonthlySalesBreakdownChart data={metrics.monthlyBreakdown} />
        <PipelineByHourChart data={metrics.pipelineByHour} />
        <ProductivityByHourChart data={dashboardMetrics.productivityByHour} />
      </div>
    </div>
  );
}
