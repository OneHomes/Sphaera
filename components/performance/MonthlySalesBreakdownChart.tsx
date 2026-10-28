"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import type { MonthlyStageBreakdown } from "@/lib/agentPerformanceMetrics";

export function MonthlySalesBreakdownChart({ data }: { data: MonthlyStageBreakdown[] }) {
  return (
    <WidgetCard title="Monthly Sales" icon={BarChart3} className="md:col-span-2">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.22)" />
          <XAxis dataKey="month" stroke="#71717a" fontSize={10} />
          <YAxis
            stroke="#71717a"
            fontSize={10}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`}
          />
          <Tooltip
            contentStyle={{
              background: "rgb(var(--base-800))", color: "rgb(var(--ink-50))",
              border: "1px solid rgb(var(--base-700))",
              fontSize: 11,
            }}
            formatter={(value) => [`$${Number(value).toLocaleString()}`]}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="won" name="Closed Won" stackId="a" fill="#14b8a6" />
          <Bar dataKey="lost" name="Closed Lost" stackId="a" fill="#ef4444" />
          <Bar dataKey="expected" name="Open (Expected)" stackId="a" fill="#f59e0b" />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 text-[10px] text-ink-500">
        Won/Lost by close date, Expected by each open opportunity's expected close date.
      </p>
    </WidgetCard>
  );
}
