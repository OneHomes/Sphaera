import { Trophy, Flame, Award, History } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { ChallengePicker } from "./ChallengePicker";
import type { Tier } from "@/lib/businessActivityData";
import { ProductivityIndexCard } from "./ProductivityIndexCard";
import { JanusCoachingCard } from "./JanusCoachingCard";
const tierStyles: Record<Tier, string> = {
  Gold: "bg-tier-gold/15 text-tier-gold",
  Silver: "bg-tier-silver/15 text-tier-silver",
  Bronze: "bg-tier-bronze/15 text-tier-bronze",
};

export type AexBadge = {
  id: string;
  name: string;
  description: string;
  earned: boolean;
};

export type AexStreak = {
  id: string;
  label: string;
  currentCount: number;
  resetRule: string;
};

export type AexPointEvent = {
  id: string;
  label: string;
  points: number;
  timestamp: string;
};

export type AexLeaderboardRow = {
  rank: number;
  id: string;
  name: string;
  tier: Tier;
  points: number;
};

function TierProgressCard({
  tier,
  points,
  nextTier,
  pointsToNextTier,
}: {
  tier: Tier;
  points: number;
  nextTier: Tier | null;
  pointsToNextTier: number;
}) {
  const total = points + pointsToNextTier;
  const percent = total > 0 ? Math.round((points / total) * 100) : 100;

  return (
    <WidgetCard title="Your tier progress" icon={Trophy}>
      <div className="flex items-center justify-between">
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${tierStyles[tier]}`}
        >
          {tier}
        </span>
        {nextTier && (
          <span className="text-xs text-ink-500">
            {pointsToNextTier} pts to {nextTier}
          </span>
        )}
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-base-700">
        <div
          className="h-2 rounded-full bg-status-active"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-ink-500">
        {points.toLocaleString()} points total
      </p>
    </WidgetCard>
  );
}

function BadgesGrid({ badges }: { badges: AexBadge[] }) {
  return (
    <WidgetCard title="Badges" icon={Award}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {badges.map((badge) => (
          <div
            key={badge.id}
            title={badge.description}
            className="rounded-lg border border-status-active/30 bg-status-active/10 p-2.5 text-center"
          >
            <Award className="mx-auto h-5 w-5 text-status-active" />
            <p className="mt-1.5 text-[11px] text-ink-300">{badge.name}</p>
          </div>
        ))}
        {badges.length === 0 && (
          <p className="col-span-full py-3 text-center text-xs text-ink-500">
            No badges earned yet
          </p>
        )}
      </div>
    </WidgetCard>
  );
}

function StreaksCard({ streaks }: { streaks: AexStreak[] }) {
  return (
    <WidgetCard title="Streaks" icon={Flame}>
      <div className="space-y-3">
        {streaks.map((streak) => (
          <div key={streak.id}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-300">{streak.label}</span>
              <span className="text-sm font-semibold text-status-alert">
                {streak.currentCount} days
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-ink-500">
              {streak.resetRule}
            </p>
          </div>
        ))}
        {streaks.length === 0 && (
          <p className="py-3 text-center text-xs text-ink-500">
            No active streaks yet
          </p>
        )}
      </div>
    </WidgetCard>
  );
}

function PointsHistoryTable({ pointEvents }: { pointEvents: AexPointEvent[] }) {
  return (
    <WidgetCard title="Recent points" icon={History}>
      <div className="space-y-2">
        {pointEvents.map((event) => (
          <div
            key={event.id}
            className="flex items-center justify-between text-xs"
          >
            <div>
              <p className="text-ink-300">{event.label}</p>
              <p className="text-[11px] text-ink-500">{event.timestamp}</p>
            </div>
            <span className="font-semibold text-status-active">
              +{event.points}
            </span>
          </div>
        ))}
        {pointEvents.length === 0 && (
          <p className="py-3 text-center text-xs text-ink-500">
            No point events yet
          </p>
        )}
      </div>
    </WidgetCard>
  );
}

function LeaderboardTable({
  leaderboard,
}: {
  leaderboard: AexLeaderboardRow[];
}) {
  return (
    <WidgetCard title="Team leaderboard" icon={Trophy}>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-ink-500">
            <th className="pb-2 font-normal">#</th>
            <th className="pb-2 font-normal">Agent</th>
            <th className="pb-2 font-normal">Tier</th>
            <th className="pb-2 font-normal text-right">Points</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((row) => (
            <tr key={row.id} className="border-t border-base-700 text-ink-300">
              <td className="py-2 text-ink-500">{row.rank}</td>
              <td className="py-2 font-medium text-ink-50">{row.name}</td>
              <td className="py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tierStyles[row.tier]}`}
                >
                  {row.tier}
                </span>
              </td>
              <td className="py-2 text-right">{row.points.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {leaderboard.length <= 1 && (
        <p className="mt-2 text-[10px] text-ink-500">
          Leaderboard fills in as more team members sign in — this reflects
          real signed-in users, not mock agents.
        </p>
      )}
    </WidgetCard>
  );
}

export function AexDashboard({
  tier,
  points,
  nextTier,
  pointsToNextTier,
  badges,
  streaks,
  pointEvents,
  leaderboard,
}: {
  tier: Tier;
  points: number;
  nextTier: Tier | null;
  pointsToNextTier: number;
  badges: AexBadge[];
  streaks: AexStreak[];
  pointEvents: AexPointEvent[];
  leaderboard: AexLeaderboardRow[];
}) {
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-ink-50">AEX</h1>
      <p className="mb-5 text-sm text-ink-500">
        Performance, tiers, points, and challenges.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <TierProgressCard
          tier={tier}
          points={points}
          nextTier={nextTier}
          pointsToNextTier={pointsToNextTier}
        />
        <StreaksCard streaks={streaks} />
        <ProductivityIndexCard />
        <ChallengePicker leaderboard={leaderboard} />
        <JanusCoachingCard />
        <BadgesGrid badges={badges} />
        <PointsHistoryTable pointEvents={pointEvents} />
        <LeaderboardTable leaderboard={leaderboard} />
      </div>
    </div>
  );
}