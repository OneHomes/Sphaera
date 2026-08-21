import type { Session } from "next-auth";
import { LeftRail } from "./LeftRail";
import { TopLeaderboardBar } from "./TopLeaderboardBar";

export function AppShell({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: Session | null;
}) {
  return (
    <div className="flex h-screen w-full bg-base-950">
      <LeftRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopLeaderboardBar session={session} />
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
