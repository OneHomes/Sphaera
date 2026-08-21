"use client";

import { Award } from "lucide-react";
import { tierSequence, roadToSuccessItems, nextTierUnlocks } from "@/lib/onboardingData";

const tierColor: Record<string, string> = {
  Gold: "text-tier-gold",
  Silver: "text-tier-silver",
  Bronze: "text-tier-bronze",
};

export function RoadToSuccess({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-base-950 px-6 py-10">
      <h1 className="text-2xl font-semibold text-ink-50">
        You&apos;re starting in{" "}
        <span className="text-tier-bronze">Bronze Tier</span>
      </h1>

      <div className="flex gap-4">
        {tierSequence.map((tier, i) => (
          <div
            key={i}
            className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-base-700"
          >
            <Award className={`h-7 w-7 ${tierColor[tier]}`} />
          </div>
        ))}
      </div>

      <div className="w-full max-w-2xl rounded-xl border border-base-700 bg-base-900 p-6">
        <h2 className="mb-4 text-center text-sm font-medium text-ink-50">
          Road to success
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            {roadToSuccessItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-ink-300">{item.target}</span>
                <span className="text-ink-500">{item.points} points</span>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-base-700 bg-base-800 p-4">
            <ul className="space-y-2">
              {nextTierUnlocks.map((unlock) => (
                <li
                  key={unlock}
                  className="flex items-start gap-2 text-[11px] text-ink-300"
                >
                  <span className="mt-0.5 text-status-active">✓</span>
                  {unlock}
                </li>
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
