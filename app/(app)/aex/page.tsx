import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { tierForPoints, nextTierInfo } from "@/lib/aexTransform";
import { getAexConfig } from "@/lib/aexConfig";
import { formatRelativeTime } from "@/lib/leadTransform";
import { AexDashboard } from "@/components/aex/AexDashboard";

export const dynamic = "force-dynamic";

export default async function AexPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const user = await getOrCreateCurrentUser(session);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [pointEvents, badges, streaks, pointsAgg, allUsers, aexConfig, todayAgg, monthEvents] =
    await Promise.all([
      prisma.aexPointEvent.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.userBadge.findMany({ where: { userId: user.id } }),
      prisma.userStreak.findMany({ where: { userId: user.id } }),
      prisma.aexPointEvent.aggregate({
        where: { userId: user.id },
        _sum: { points: true },
      }),
      prisma.user.findMany({
        include: { pointEvents: { select: { points: true } } },
      }),
      getAexConfig(),
      // PRD AEX 14.5 — Daily Club: real points earned today.
      prisma.aexPointEvent.aggregate({
        where: { userId: user.id, createdAt: { gte: startOfToday } },
        _sum: { points: true },
      }),
      // PRD AEX 14.5 — "longer period classification": this month's
      // top point earner across visible users.
      prisma.aexPointEvent.findMany({
        where: { createdAt: { gte: startOfMonth } },
        select: { userId: true, points: true },
      }),
    ]);

  const totalPoints = pointsAgg._sum.points ?? 0;
  const tier = tierForPoints(totalPoints, aexConfig.tierThresholds);
  const { nextTier, pointsToNextTier } = nextTierInfo(totalPoints, aexConfig.tierThresholds);

  const leaderboard = allUsers
    .map((u) => {
      const points = u.pointEvents.reduce((sum, e) => sum + e.points, 0);
      return { id: u.id, name: u.name, tier: tierForPoints(points, aexConfig.tierThresholds), points };
    })
    .sort((a, b) => b.points - a.points)
    .map((row, i) => ({ ...row, rank: i + 1 }));

  // PRD AEX 14.5 — Daily Club + this month's top earner.
  const todayPoints = todayAgg._sum.points ?? 0;
  const dailyClub = {
    qualified: todayPoints >= aexConfig.dailyClubPointThreshold,
    todayPoints,
    threshold: aexConfig.dailyClubPointThreshold,
  };

  const monthTotals = new Map<string, number>();
  for (const e of monthEvents) {
    monthTotals.set(e.userId, (monthTotals.get(e.userId) ?? 0) + e.points);
  }
  let monthlyChampion: { id: string; name: string; points: number } | null = null;
  for (const [userId, points] of monthTotals.entries()) {
    if (!monthlyChampion || points > monthlyChampion.points) {
      const u = allUsers.find((au) => au.id === userId);
      if (u) monthlyChampion = { id: u.id, name: u.name, points };
    }
  }

  return (
    <AexDashboard
      tier={tier}
      points={totalPoints}
      nextTier={nextTier}
      pointsToNextTier={pointsToNextTier}
      dailyClub={dailyClub}
      monthlyChampion={monthlyChampion}
      badges={badges.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        earned: true,
      }))}
      streaks={streaks.map((s) => ({
        id: s.id,
        label: s.label,
        currentCount: s.currentCount,
        resetRule: s.resetRule,
      }))}
      pointEvents={pointEvents.map((e) => ({
        id: e.id,
        label: e.label,
        points: e.points,
        timestamp: formatRelativeTime(e.createdAt),
      }))}
      leaderboard={leaderboard}
    />
  );
}