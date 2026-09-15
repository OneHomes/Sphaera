"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Clock } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import type { HourlyPipelinePoint } from "@/lib/agentPerformanceMetrics";

export function PipelineByHourChart({ data }: { data: HourlyPipelinePoint[] }) {
  return (
    <WidgetCard title="Pipeline Contribution by Hour" icon={Clock}>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#232327" />
          <XAxis dataKey="hour" stroke="#71717a" fontSize={9} interval={2} />
          <YAxis
            stroke="#71717a"
            fontSize={10}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
          />
          <Tooltip
            contentStyle={{
              background: "#1a1a1d",
              border: "1px solid #232327",
              fontSize: 11,
            }}
            formatter={(value) => [`$${Number(value).toLocaleString()}`, "Pipeline moved"]}
          />
          <Bar dataKey="value" fill="#14b8a6" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 text-[10px] text-ink-500">
        $ value of your opportunities updated in that hour, last 30 days.
      </p>
    </WidgetCard>
  );
}
