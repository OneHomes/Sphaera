"use client";

import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { Gauge } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { formatCurrency } from "@/lib/dashboardData";
import { TARGET_METRICS } from "@/lib/targetTracker";
import type { TargetGaugeData } from "@/lib/agentPerformanceMetrics";

const STATUS_COLORS = {
  onTrack: "#14b8a6", // status.active
  watch: "#f59e0b", // status.alert
  critical: "#ef4444", // status.inactive
};

function metricLabel(metric: TargetGaugeData["metric"]): string {
  return TARGET_METRICS.find((m) => m.key === metric)?.label ?? metric;
}

function formatValue(metric: TargetGaugeData["metric"], value: number): string {
  return metric === "revenue" ? formatCurrency(value) : value.toLocaleString();
}

export function WeeklyTargetGauge({ target }: { target: TargetGaugeData }) {
  const totalDays = Math.max(
    1,
    Math.round(
      (new Date(target.periodEnd).getTime() - new Date(target.periodStart).getTime()) /
        86_400_000
    )
  );
  const elapsedDays = Math.max(0, totalDays - target.daysRemaining);
  const elapsedPercent = Math.min(100, Math.round((elapsedDays / totalDays) * 100));
  const displayPercent = Math.min(100, target.percentComplete);

  const gap = elapsedPercent - target.percentComplete;
  const status: keyof typeof STATUS_COLORS =
    target.percentComplete >= 100 || gap <= 0
      ? "onTrack"
      : gap <= 20
        ? "watch"
        : "critical";

  const stage =
    elapsedPercent >= 100
      ? "Period has ended"
      : elapsedPercent >= 50
        ? "Critical Stage"
        : elapsedPercent >= 20
          ? "Mid Stage"
          : "Early Stage";

  let statusLine: string;
  if (target.percentComplete >= 100) {
    statusLine = `Target achieved — ${target.percentComplete}% of goal reached.`;
  } else if (status === "onTrack") {
    statusLine = `${elapsedPercent}% of the period has passed and you're on pace at ${target.percentComplete}% of target.`;
  } else {
    statusLine = `${elapsedPercent}% of the period has passed, you are ${gap}pt behind pace.`;
  }

  if (target.missedStreak > 0) {
    statusLine += ` You've missed your last ${target.missedStreak} ${
      target.missedStreak === 1 ? "period" : "periods"
    } for this target — if you miss this one too, your points for this cycle will fall short of the next tier.`;
  }

  const data = [
    {
      name: metricLabel(target.metric),
      value: displayPercent,
      fill: STATUS_COLORS[status],
    },
  ];

  return (
    <WidgetCard title="Overall Target" icon={Gauge}>
      <div className="flex flex-col items-center">
        <div className="relative h-[140px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              innerRadius="70%"
              outerRadius="100%"
              barSize={12}
              data={data}
              startAngle={220}
              endAngle={-40}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar dataKey="value" background={{ fill: "#232327" }} cornerRadius={8} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-lg font-semibold text-ink-50">
              {formatValue(target.metric, target.actualValue)}
            </p>
            <p className="text-[10px] text-ink-500">
              of {formatValue(target.metric, target.targetValue)}
            </p>
          </div>
        </div>
        <p className="mt-1 text-xs font-medium" style={{ color: STATUS_COLORS[status] }}>
          {stage}: {target.percentComplete}%
        </p>
        <p className="mt-1 text-[10px] leading-snug text-ink-500">{statusLine}</p>
      </div>
    </WidgetCard>
  );
}
