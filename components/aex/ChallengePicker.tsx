"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { Swords } from "lucide-react";
import { leaderboardData, formatCompactCurrency } from "@/lib/mockData";

export function ChallengePicker() {
  const [challengedName, setChallengedName] = useState<string | null>(null);
  const [scrollIndex, setScrollIndex] = useState(0);

  const visibleCount = 5;
  const maxIndex = Math.max(0, leaderboardData.length - visibleCount);

  function handleChallenge(name: string) {
    // TODO: send a real peer-challenge request once the AEX challenge
    // engine exists (PRD Section 14.10 — user selection of eligible peer
    // challengers). Must not expose sensitive compensation data.
    setChallengedName(name);
  }

  const visibleAgents = leaderboardData.slice(scrollIndex, scrollIndex + visibleCount);

  return (
    <WidgetCard title="Pick a Challenger" icon={Swords}>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setScrollIndex((i) => Math.max(0, i - 1))}
          disabled={scrollIndex === 0}
          className="shrink-0 rounded-full border border-base-700 p-1.5 text-ink-300 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex flex-1 justify-center gap-3 overflow-hidden">
          {visibleAgents.map((agent, i) => {
            const rank = scrollIndex + i + 1;
            const isChallenged = challengedName === agent.name;
            return (
              <button
                key={agent.id}
                onClick={() => handleChallenge(agent.name)}
                className={`relative flex w-28 shrink-0 flex-col items-center gap-2 rounded-xl border p-3 text-center transition ${
                  isChallenged
                    ? "border-ink-50 bg-base-800"
                    : "border-base-700 bg-base-900 hover:border-base-600"
                }`}
              >
                {isChallenged && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-ink-50 px-2 py-0.5 text-[9px] font-semibold text-base-950">
                    Challenged
                  </span>
                )}
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-base-700 text-sm font-semibold text-ink-50">
                  {agent.name.replace("Agent ", "A")}
                </div>
                <p className="text-xs font-medium text-ink-50">{agent.name}</p>
                <p className="text-[10px] text-ink-500">
                  {formatCompactCurrency(agent.revenue)}
                </p>
                <span className="text-[9px] text-status-active">
                  #{rank}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setScrollIndex((i) => Math.min(maxIndex, i + 1))}
          disabled={scrollIndex >= maxIndex}
          className="shrink-0 rounded-full border border-base-700 p-1.5 text-ink-300 disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {challengedName && (
        <p className="mt-3 text-center text-xs text-ink-300">
          Challenge sent to <span className="text-ink-50">{challengedName}</span>.
        </p>
      )}
    </WidgetCard>
  );
}
