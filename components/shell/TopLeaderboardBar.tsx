import type { Session } from "next-auth";
import { leaderboardData, formatCompactCurrency } from "@/lib/mockData";
import { SignOutButton } from "./SignOutButton";

export function TopLeaderboardBar({ session }: { session?: Session | null }) {
  const userName = session?.user?.name ?? session?.user?.email ?? "Signed in";

  return (
    <div className="flex h-11 items-center border-b border-base-700 bg-base-950 px-3">
      <div
        role="marquee"
        aria-label="Live agent leaderboard"
        className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:thin]"
      >
        {leaderboardData.map((entry, index) => (
          <div
            key={entry.id}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-ink-300"
          >
            <span className="text-ink-500">{index + 1}.</span>
            <span className="font-medium text-ink-50">{entry.name}:</span>
            <span className="text-status-active">
              {formatCompactCurrency(entry.revenue)}
            </span>
          </div>
        ))}
      </div>
      <div className="ml-3 shrink-0">
        <SignOutButton userName={userName} />
      </div>
    </div>
  );
}
