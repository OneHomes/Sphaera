"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { WidgetCard } from "./WidgetCard";
import { productivityByHour, agentActivityIndex } from "@/lib/dashboardData";

export function ProductivityByHourChart() {
  const [selectedAgent, setSelectedAgent] = useState(
    agentActivityIndex[0]?.name ?? "Agent 1"
  );

  // TODO: once activity events are queryable per user, refetch/recompute
  // `productivityByHour` filtered by `selectedAgent` instead of sharing
  // one static series across all agents.

  return (
    <WidgetCard
      title="Productivity by Hour"
      icon={BarChart3}
      action={
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="rounded-md border border-base-700 bg-base-800 px-2 py-1 text-xs text-ink-300 outline-none"
        >
          {agentActivityIndex.map((agent) => (
            <option key={agent.name + agent.extension} value={agent.name}>
              {agent.name}
            </option>
          ))}
        </select>
      }
    >
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={productivityByHour}
            margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
          >
            <XAxis
              dataKey="hour"
              tick={{ fill: "#71717a", fontSize: 10 }}
              axisLine={{ stroke: "#232327" }}
              tickLine={false}
              interval={1}
            />
            <YAxis
              tick={{ fill: "#71717a", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "#1a1a1d",
                border: "1px solid #2e2e33",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#fafafa" }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </WidgetCard>
  );
}
