"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { WidgetCard } from "./WidgetCard";
import type { MonthlySalesPoint } from "@/lib/dashboardMetrics";

export function MonthlySalesChart({ data }: { data: MonthlySalesPoint[] }) {
  return (
    <WidgetCard title="Monthly Sales" icon={TrendingUp}>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#232327" />
          <XAxis dataKey="month" stroke="#71717a" fontSize={10} />
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
                        formatter={(value) => [
              `$${Number(value).toLocaleString()}`,
              "Closed Value",
            ]}
          />
          <Line
            type="monotone"
            dataKey="closedValue"
            stroke="#14b8a6"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}