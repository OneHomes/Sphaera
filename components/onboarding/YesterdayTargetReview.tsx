"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { WelcomeData, WelcomePeriod, WelcomeTargetRow } from "@/lib/dailyWelcome";

const statusColors: Record<WelcomeTargetRow["status"], string> = {
  Critical: "bg-status-inactive",
  Watch: "bg-status-alert",
  Good: "bg-status-active",
};

function TargetRow({ row }: { row: WelcomeTargetRow }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 text-xs text-ink-300">{row.label}:</span>
      <div className="relative h-6 flex-1 overflow-hidden rounded-full bg-base-800">
        <div
          className={`h-full ${statusColors[row.status]}`}
          style={{ width: `${Math.min(100, row.percentComplete)}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] font-medium text-white">
          {row.percentComplete}%
        </span>
      </div>
      <span className="w-10 shrink-0 text-right text-[11px] text-ink-500">100%</span>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-full bg-base-800 px-4 py-2 text-xs">
      <span className="text-ink-300">{label}</span>
      <span className="font-semibold text-ink-50">{value}</span>
    </div>
  );
}

export function YesterdayTargetReview({
  data,
  janusInsight,
  onContinue,
}: {
  data: WelcomeData;
  janusInsight: string | null;
  onContinue: () => void;
}) {
  const [leftTab, setLeftTab] = useState<"yesterday" | "today">("yesterday");
  const [rightTab, setRightTab] = useState<WelcomePeriod>("weekly");

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 bg-base-950 px-6 py-10">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-ink-50">Welcome back</h1>
        <p className="mt-1 max-w-md text-xs text-ink-500">
          Here&apos;s how yesterday went, and where today&apos;s targets stand.
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

          {leftTab === "yesterday" ? (
            <div className="space-y-3">
              <StatRow label="Calls" value={data.yesterday.calls} />
              <StatRow label="Meetings Booked" value={data.yesterday.meetingsBooked} />
              <StatRow label="Meetings Conducted" value={data.yesterday.meetingsConducted} />
            </div>
          ) : data.todayTargets.length > 0 ? (
            <div className="space-y-3">
              {data.todayTargets.map((row) => (
                <TargetRow key={row.metric} row={row} />
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-xs text-ink-500">No target set for today yet.</p>
          )}

          <div className="mt-4 rounded-lg border border-base-700 bg-base-800 p-3 text-[11px] leading-relaxed text-ink-300">
            {janusInsight === null ? (
              <span className="flex items-center gap-2 text-ink-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                Janus couldn&apos;t prepare an insight right now.
              </span>
            ) : (
              janusInsight
            )}
          </div>
        </div>

        <div className="rounded-xl border border-base-700 bg-base-900 p-5">
          <div className="mb-4 flex gap-4 border-b border-base-700 text-sm">
            {(["weekly", "monthly", "yearly"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setRightTab(p)}
                className={`pb-2 capitalize ${rightTab === p ? "border-b-2 border-ink-50 text-ink-50" : "text-ink-500"}`}
              >
                {p} Target
              </button>
            ))}
          </div>

          {data.periodTargets[rightTab].length > 0 ? (
            <div className="space-y-3">
              {data.periodTargets[rightTab].map((row) => (
                <TargetRow key={row.metric} row={row} />
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-xs text-ink-500">No {rightTab} target set yet.</p>
          )}

          {data.summary.length > 0 && (
            <div className="mt-4 text-xs">
              <p className="mb-1.5 text-ink-500">Summary:</p>
              <ul className="space-y-0.5 text-ink-300">
                {data.summary.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
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
