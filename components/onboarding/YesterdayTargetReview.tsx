"use client";

import { useState } from "react";
import {
  yesterdayMetrics,
  weeklyTargetMetrics,
  weeklySummary,
  janusYesterdayInsight,
  type MetricBar,
} from "@/lib/onboardingData";

function MetricRow({ metric }: { metric: MetricBar }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 text-xs text-ink-300">
        {metric.label}:
      </span>
      <div className="h-6 flex-1 overflow-hidden rounded-full bg-base-800">
        <div
          className={`flex h-full items-center justify-end rounded-full px-2 text-[10px] font-medium text-base-950 ${metric.colorClass}`}
          style={{ width: `${Math.min(metric.percent, 100)}%` }}
        >
          {metric.percent}%
        </div>
      </div>
      <span className="w-10 shrink-0 text-right text-[11px] text-ink-500">
        100%
      </span>
    </div>
  );
}

export function YesterdayTargetReview({
  onContinue,
}: {
  onContinue: () => void;
}) {
  const [leftTab, setLeftTab] = useState<"yesterday" | "today">("yesterday");
  const [rightTab, setRightTab] = useState<"weekly" | "monthly" | "yearly">(
    "weekly"
  );

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 bg-base-950 px-6 py-10">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-ink-50">
          Welcome back, Agent 1
        </h1>
        <p className="mt-1 max-w-md text-xs text-ink-500">
          Find the best-performing email or locate the conversation where
          John and I discussed a 10% discount.
        </p>
      </div>

      <div className="grid w-full max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-base-700 bg-base-900 p-5">
          <div className="mb-4 flex gap-4 border-b border-base-700 text-sm">
            <button
              onClick={() => setLeftTab("yesterday")}
              className={`pb-2 ${leftTab === "yesterday" ? "border-b-2 border-ink-50 text-ink-50" : "text-ink-500"}`}
            >
              Yesterday
            </button>
            <button
              onClick={() => setLeftTab("today")}
              className={`pb-2 ${leftTab === "today" ? "border-b-2 border-ink-50 text-ink-50" : "text-ink-500"}`}
            >
              Today&apos;s Target
            </button>
          </div>
          <div className="space-y-3">
            {yesterdayMetrics.map((m) => (
              <MetricRow key={m.label} metric={m} />
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-base-700 bg-base-800 p-3 text-[11px] leading-relaxed text-ink-300">
            {janusYesterdayInsight}
          </div>
        </div>

        <div className="rounded-xl border border-base-700 bg-base-900 p-5">
          <div className="mb-4 flex gap-4 border-b border-base-700 text-sm">
            <button
              onClick={() => setRightTab("weekly")}
              className={`pb-2 ${rightTab === "weekly" ? "border-b-2 border-ink-50 text-ink-50" : "text-ink-500"}`}
            >
              Weekly Target
            </button>
            <button
              onClick={() => setRightTab("monthly")}
              className={`pb-2 ${rightTab === "monthly" ? "border-b-2 border-ink-50 text-ink-50" : "text-ink-500"}`}
            >
              Monthly Target
            </button>
            <button
              onClick={() => setRightTab("yearly")}
              className={`pb-2 ${rightTab === "yearly" ? "border-b-2 border-ink-50 text-ink-50" : "text-ink-500"}`}
            >
              Yearly Target
            </button>
          </div>
          <div className="space-y-3">
            {weeklyTargetMetrics.map((m) => (
              <MetricRow key={m.label} metric={m} />
            ))}
          </div>

          <div className="mt-4 text-xs">
            <p className="mb-1.5 text-ink-500">Summary:</p>
            <ul className="space-y-0.5 text-ink-300">
              {weeklySummary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <button
        onClick={onContinue}
        className="rounded-lg bg-status-active px-8 py-2.5 text-sm font-semibold text-base-950 hover:brightness-110"
      >
        Next
      </button>
    </div>
  );
}
