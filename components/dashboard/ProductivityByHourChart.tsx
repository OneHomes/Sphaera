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
import { Activity } from "lucide-react";
import { WidgetCard } from "./WidgetCard";
import type { ProductivityPoint } from "@/lib/dashboardMetrics";

export function ProductivityByHourChart({
  data,
}: {
  data: ProductivityPoint[];
}) {
  return (
    <WidgetCard title="Productivity by Hour" icon={Activity}>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#232327" />
          <XAxis dataKey="hour" stroke="#71717a" fontSize={9} interval={2} />
          <YAxis stroke="#71717a" fontSize={10} />
          <Tooltip
            contentStyle={{
              background: "#1a1a1d",
              border: "1px solid #232327",
              fontSize: 11,
            }}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-1 text-[10px] text-ink-500">
        Based on your logged calls/emails/meetings over the last 30 days.
      </p>
    </WidgetCard>
  );
}