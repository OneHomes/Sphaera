"use client";

import {
  Wallet,
  Phone,
  CalendarPlus,
  CalendarCheck,
  Gauge,
} from "lucide-react";
import { todayTargetComparison, type TargetComparisonRow } from "@/lib/onboardingData";

const iconMap = {
  collections: Wallet,
  calls: Phone,
  meetingsBooked: CalendarPlus,
  meetingsConducted: CalendarCheck,
  productivity: Gauge,
};

function RingStat({
  percent,
  label,
  value,
  ringColorHex,
}: {
  percent: number;
  label: string;
  value: string;
  ringColorHex: string;
}) {
  const clamped = Math.min(percent, 100);
  return (
    <div className="flex items-center gap-2">
      <div
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(${ringColorHex} ${clamped * 3.6}deg, #2e2e33 0deg)`,
        }}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-base-800 text-[10px] font-semibold text-ink-50">
          {percent}%
        </div>
      </div>
      <div>
        <p className="text-[10px] text-ink-500">{label}</p>
        <p className="text-xs text-ink-300">{value}</p>
      </div>
    </div>
  );
}

function ComparisonCard({ row }: { row: TargetComparisonRow }) {
  const Icon = iconMap[row.icon];
  return (
    <div className="flex items-center gap-4 rounded-lg border border-base-700 bg-base-900 p-3.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-base-800 text-ink-300">
        <Icon className="h-4 w-4" />
      </div>
      <p className="w-32 shrink-0 text-sm text-ink-50">{row.label}</p>
      <RingStat
        percent={row.previousPercent}
        label="PREVIOUS"
        value={row.previousValue}
        ringColorHex="#71717a"
      />
      <RingStat
        percent={row.newPercent}
        label="NEW TARGET"
        value={row.newValue}
        ringColorHex={row.isDecline ? "#ef4444" : "#14b8a6"}
      />
    </div>
  );
}

export function TargetAcceptance({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-base-950 px-6 py-10">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-ink-50">
          Welcome back, Agent 1
        </h1>
        <p className="mt-1 text-xs text-ink-500">
          Review today&apos;s targets before you get started.
        </p>
      </div>

      <div className="w-full max-w-lg space-y-2.5">
        {todayTargetComparison.map((row) => (
          <ComparisonCard key={row.label} row={row} />
        ))}
      </div>

      <button
        onClick={onAccept}
        className="rounded-lg bg-status-active px-8 py-2.5 text-sm font-semibold text-base-950 hover:brightness-110"
      >
        Accept
      </button>
    </div>
  );
}
