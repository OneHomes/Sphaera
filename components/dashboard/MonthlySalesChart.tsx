"use client";

import { TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { WidgetCard } from "./WidgetCard";
import { monthlySales } from "@/lib/dashboardData";

export function MonthlySalesChart() {
  return (
    <WidgetCard title="Monthly Sales" icon={TrendingUp}>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={monthlySales} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="#232327" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fill: "#71717a", fontSize: 11 }}
              axisLine={{ stroke: "#232327" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#71717a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}M`}
            />
            <Tooltip
              contentStyle={{
                background: "#1a1a1d",
                border: "1px solid #2e2e33",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#fafafa" }}
              formatter={(value) => [
                `$${Number(value).toLocaleString()}`,
                "Closed value",
              ]}
            />
            <Line
              type="monotone"
              dataKey="closedValue"
              stroke="#14b8a6"
              strokeWidth={2}
              dot={{ r: 3, fill: "#14b8a6" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}
