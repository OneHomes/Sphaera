import type { Session } from "next-auth";
import { LeftRail } from "./LeftRail";
import {
  TopLeaderboardBar,
  type RevenueLeaderboardEntry,
} from "./TopLeaderboardBar";

export function AppShell({
  children,
  session,
  leaderboard,
}: {
  children: React.ReactNode;
  session?: Session | null;
  leaderboard: RevenueLeaderboardEntry[];
}) {
  return (
    <div className="flex h-screen w-full bg-base-950">
      <LeftRail role={session?.user?.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopLeaderboardBar session={session} leaderboard={leaderboard} />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}