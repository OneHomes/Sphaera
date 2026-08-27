"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Swords } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import type { AexLeaderboardRow } from "./AexDashboard";

export function ChallengePicker({
  leaderboard,
}: {
  leaderboard: AexLeaderboardRow[];
}) {
  const [challengedId, setChallengedId] = useState<string | null>(null);
  const [scrollIndex, setScrollIndex] = useState(0);

  const visibleCount = 5;
  const maxIndex = Math.max(0, leaderboard.length - visibleCount);

  function handleChallenge(id: string) {
    // TODO: send a real peer-challenge request once the AEX challenge
    // engine exists (PRD Section 14.10 — user selection of eligible peer
    // challengers). Must not expose sensitive compensation data.
    setChallengedId(id);
  }

  const visibleRows = leaderboard.slice(scrollIndex, scrollIndex + visibleCount);
  const challengedRow = leaderboard.find((r) => r.id === challengedId);

  return (
    <WidgetCard title="Pick a Challenger" icon={Swords}>
      {leaderboard.length === 0 ? (
        <p className="py-6 text-center text-xs text-ink-500">
          No other team members have signed in yet — challenges need at
          least one other person on the leaderboard.
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScrollIndex((i) => Math.max(0, i - 1))}
            disabled={scrollIndex === 0}
            className="shrink-0 rounded-full border border-base-700 p-1.5 text-ink-300 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex flex-1 justify-center gap-3 overflow-hidden">
            {visibleRows.map((row) => {
              const isChallenged = challengedId === row.id;
              return (
                <button
                  key={row.id}
                  onClick={() => handleChallenge(row.id)}
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
                    {row.name.charAt(0)}
                  </div>
                  <p className="text-xs font-medium text-ink-50">
                    {row.name}
                  </p>
                  <p className="text-[10px] text-ink-500">
                    {row.points.toLocaleString()} pts
                  </p>
                  <span className="text-[9px] text-status-active">
                    #{row.rank}
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
      )}

      {challengedRow && (
        <p className="mt-3 text-center text-xs text-ink-300">
          Challenge sent to <span className="text-ink-50">{challengedRow.name}</span>.
        </p>
      )}
    </WidgetCard>
  );
}