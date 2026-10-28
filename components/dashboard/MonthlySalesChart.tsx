"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { TrendingUp, DollarSign, Hash } from "lucide-react";
import { WidgetCard } from "./WidgetCard";
import type { MonthlySalesPoint } from "@/lib/dashboardMetrics";

type ViewMode = "value" | "count";

export function MonthlySalesChart({ data }: { data: MonthlySalesPoint[] }) {
  const [mode, setMode] = useState<ViewMode>("value");
  const dataKey = mode === "value" ? "closedValue" : "closedCount";

  return (
    <WidgetCard
      title="Monthly Sales"
      icon={TrendingUp}
      action={
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMode("value")}
            aria-label="Show closed value"
            title="Closed value"
            className={`rounded p-1 ${mode === "value" ? "bg-status-active/15 text-status-active" : "text-ink-500 hover:text-ink-300"}`}
          >
            <DollarSign className="h-3 w-3" />
          </button>
          <button
            onClick={() => setMode("count")}
            aria-label="Show deal count"
            title="Deal count"
            className={`rounded p-1 ${mode === "count" ? "bg-status-active/15 text-status-active" : "text-ink-500 hover:text-ink-300"}`}
          >
            <Hash className="h-3 w-3" />
          </button>
        </div>
      }
    >
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.22)" />
          <XAxis dataKey="month" stroke="#71717a" fontSize={10} />
          <YAxis
            stroke="#71717a"
            fontSize={10}
            tickFormatter={(v) => (mode === "value" ? `$${(v / 1000).toFixed(0)}K` : v)}
          />
          <Tooltip
            contentStyle={{
              background: "rgb(var(--base-800))", color: "rgb(var(--ink-50))",
              border: "1px solid rgb(var(--base-700))",
              fontSize: 11,
            }}
            formatter={(value) => [
              mode === "value" ? `$${Number(value).toLocaleString()}` : `${value} deals`,
              mode === "value" ? "Closed Value" : "Closed Deals",
            ]}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke="#14b8a6"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </WidgetCard>
  );
}
