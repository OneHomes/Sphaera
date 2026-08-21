import { Trophy, Flame, Award, Target, History } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { ChallengePicker } from "./ChallengePicker";
import type { Tier } from "@/lib/businessActivityData";
import {
  pointsHistory,
  badges,
  streaks,
  challenges,
  leaderboard,
  currentUserProgress,
} from "@/lib/aexData";

const tierStyles: Record<Tier, string> = {
  Gold: "bg-tier-gold/15 text-tier-gold",
  Silver: "bg-tier-silver/15 text-tier-silver",
  Bronze: "bg-tier-bronze/15 text-tier-bronze",
};

function TierProgressCard() {
  const { tier, points, pointsToNextTier, nextTier } = currentUserProgress;
  const total = points + pointsToNextTier;
  const percent = Math.round((points / total) * 100);

  return (
    <WidgetCard title="Your tier progress" icon={Trophy}>
      <div className="flex items-center justify-between">
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${tierStyles[tier]}`}
        >
          {tier}
        </span>
        <span className="text-xs text-ink-500">
          {pointsToNextTier} pts to {nextTier}
        </span>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-base-700">
        <div
          className="h-2 rounded-full bg-status-active"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-ink-500">
        {points.toLocaleString()} / {total.toLocaleString()} points this
        period
      </p>
    </WidgetCard>
  );
}

function BadgesGrid() {
  return (
    <WidgetCard title="Badges" icon={Award}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {badges.map((badge) => (
          <div
            key={badge.id}
            title={badge.description}
            className={`rounded-lg border p-2.5 text-center ${
              badge.earned
                ? "border-status-active/30 bg-status-active/10"
                : "border-base-700 bg-base-800 opacity-50"
            }`}
          >
            <Award
              className={`mx-auto h-5 w-5 ${
                badge.earned ? "text-status-active" : "text-ink-500"
              }`}
            />
            <p className="mt-1.5 text-[11px] text-ink-300">{badge.name}</p>
          </div>
        ))}
      </div>
    </WidgetCard>
  );
}

function StreaksCard() {
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
      </div>
    </WidgetCard>
  );
}

function ChallengesList() {
  return (
    <WidgetCard title="Challenges" icon={Target}>
      <div className="space-y-4">
        {challenges.map((challenge) => {
          const percent = Math.round(
            (challenge.progress / challenge.target) * 100
          );
          return (
            <div key={challenge.id}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink-50">{challenge.title}</span>
                <span className="text-ink-500">Ends in {challenge.endsIn}</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-base-700">
                <div
                  className="h-1.5 rounded-full bg-status-active"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-ink-500">
                {challenge.progress} / {challenge.target} {challenge.metric}
              </p>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}

function PointsHistoryTable() {
  return (
    <WidgetCard title="Recent points" icon={History}>
      <div className="space-y-2">
        {pointsHistory.map((event) => (
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
      </div>
    </WidgetCard>
  );
}

function LeaderboardTable() {
  return (
    <WidgetCard title="Team leaderboard" icon={Trophy}>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-ink-500">
            <th className="pb-2 font-normal">#</th>
            <th className="pb-2 font-normal">Agent</th>
            <th className="pb-2 font-normal">Tier</th>
            <th className="pb-2 font-normal text-right">Points</th>
            <th className="pb-2 font-normal text-right">PI</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((row) => (
            <tr key={row.rank} className="border-t border-base-700 text-ink-300">
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
              <td className="py-2 text-right">{row.pi}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </WidgetCard>
  );
}

export function AexDashboard() {
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-ink-50">AEX</h1>
      <p className="mb-5 text-sm text-ink-500">
        Performance, tiers, points, and challenges.
      </p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <TierProgressCard />
        <StreaksCard />
        <ChallengesList />
        <ChallengePicker />
        <BadgesGrid />
        <PointsHistoryTable />
        <LeaderboardTable />
      </div>
    </div>
  );
}
