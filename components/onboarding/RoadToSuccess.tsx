"use client";

import { Award } from "lucide-react";
import type { TierProgress } from "@/lib/dailyWelcome";

const TIER_ORDER = ["Bronze", "Silver", "Gold"] as const;

const tierColor: Record<string, string> = {
  Gold: "text-tier-gold",
  Silver: "text-tier-silver",
  Bronze: "text-tier-bronze",
};

export function RoadToSuccess({
  tierProgress,
  onContinue,
}: {
  tierProgress: TierProgress;
  onContinue: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-base-950 px-6 py-10">
      <h1 className="text-2xl font-semibold text-ink-50">
        You&apos;re starting in{" "}
        <span className={tierColor[tierProgress.tier]}>{tierProgress.tier} Tier</span>
      </h1>

      <div className="flex gap-4">
        {TIER_ORDER.map((tier) => (
          <div
            key={tier}
            className={`flex h-16 w-16 items-center justify-center rounded-full border-2 ${
              tier === tierProgress.tier ? "border-status-active" : "border-base-700"
            }`}
          >
            <Award className={`h-7 w-7 ${tierColor[tier]}`} />
          </div>
        ))}
      </div>

      <div className="w-full max-w-lg rounded-xl border border-base-700 bg-base-900 p-6 text-center">
        <h2 className="mb-3 text-sm font-medium text-ink-50">Road to success</h2>
        <p className="text-2xl font-semibold text-ink-50">
          {tierProgress.points.toLocaleString()} pts
        </p>
        {tierProgress.nextTier ? (
          <p className="mt-2 text-xs text-ink-500">
            {tierProgress.pointsToNextTier.toLocaleString()} more points to reach{" "}
            <span className={tierColor[tierProgress.nextTier]}>{tierProgress.nextTier}</span>
          </p>
        ) : (
          <p className="mt-2 text-xs text-ink-500">You&apos;ve reached the highest tier.</p>
        )}
        <p className="mt-4 text-[11px] leading-relaxed text-ink-500">
          Points come from real activity — logged calls, meetings, and closed
          deals — and your tier updates automatically as they add up.
        </p>
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
