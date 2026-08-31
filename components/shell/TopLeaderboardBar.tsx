"use client";

import type { Session } from "next-auth";
import { SignOutButton } from "./SignOutButton";
import { NotificationBell } from "./NotificationBell";
export type RevenueLeaderboardEntry = {
  id: string;
  name: string;
  revenue: number;
};

// TEMPORARY DEMO FALLBACK — used only when there is no real Closed Won
// revenue yet (e.g. fresh seed data, no deals closed in the app so far).
// This is NOT real data and is never stored/persisted anywhere; it exists
// purely so the marquee animation has something to visibly demonstrate
// before real revenue exists. The moment any real Closed Won opportunity
// exists, the real `leaderboard` prop takes over automatically and this
// array is never used. Remove once the pilot has real closed deals.
const DEMO_FALLBACK_LEADERBOARD: RevenueLeaderboardEntry[] = [
  { id: "demo-1", name: "Agent 1", revenue: 3_800_000 },
  { id: "demo-2", name: "Agent 2", revenue: 3_500_000 },
  { id: "demo-3", name: "Agent 3", revenue: 3_200_000 },
  { id: "demo-4", name: "Agent 4", revenue: 2_900_000 },
  { id: "demo-5", name: "Agent 5", revenue: 2_100_000 },
  { id: "demo-6", name: "Agent 6", revenue: 1_900_000 },
  { id: "demo-7", name: "Agent 7", revenue: 1_300_000 },
  { id: "demo-8", name: "Agent 8", revenue: 1_100_000 },
  { id: "demo-9", name: "Agent 9", revenue: 900_000 },
  { id: "demo-10", name: "Agent 10", revenue: 865_000 },
];

function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

export function TopLeaderboardBar({
  session,
  leaderboard,
}: {
  session?: Session | null;
  leaderboard: RevenueLeaderboardEntry[];
}) {
  const userName = session?.user?.name ?? session?.user?.email ?? "Signed in";
  const displayLeaderboard =
    leaderboard.length > 0 ? leaderboard : DEMO_FALLBACK_LEADERBOARD;
  const isDemoData = leaderboard.length === 0;

  // Duration scales with entry count so the scroll speed feels
  // consistent whether there are 3 agents or 30 (roughly 3s per entry).
  const durationSeconds = Math.max(displayLeaderboard.length * 3, 12);

  return (
    <div className="flex h-11 items-center border-b border-base-700 bg-base-950 px-3">
      <div
        role="marquee"
        aria-label="Live agent revenue leaderboard"
        className="min-w-0 flex-1 overflow-hidden"
      >
        <div
          className="flex w-max animate-marquee items-center gap-2"
          style={{ animationDuration: `${durationSeconds}s` }}
        >
          {/* Content is rendered twice back-to-back — the marquee
              animation scrolls exactly 50% of the track width, so the
              second copy seamlessly takes over where the first ends,
              creating an infinite loop with no visible jump/reset. */}
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center gap-2">
              {displayLeaderboard.map((entry, index) => (
                <div
                  key={`${copy}-${entry.id}`}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-ink-300"
                >
                  <span className="text-ink-500">{index + 1}.</span>
                  <span className="font-medium text-ink-50">
                    {entry.name}:
                  </span>
                  <span className="text-status-active">
                    {formatCompactCurrency(entry.revenue)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
           <div className="ml-3 flex shrink-0 items-center gap-2">
        {isDemoData && (
          <span className="text-[10px] text-ink-500">(demo)</span>
        )}
        <NotificationBell />
        <SignOutButton userName={userName} />
      </div>
    </div>
  );
}