import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { tierForPoints, nextTierInfo } from "@/lib/aexTransform";
import { formatRelativeTime } from "@/lib/leadTransform";
import { AexDashboard } from "@/components/aex/AexDashboard";

export const dynamic = "force-dynamic";

export default async function AexPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const user = await getOrCreateCurrentUser(session);

  const [pointEvents, badges, streaks, pointsAgg, allUsers] =
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
    ]);

  const totalPoints = pointsAgg._sum.points ?? 0;
  const tier = tierForPoints(totalPoints);
  const { nextTier, pointsToNextTier } = nextTierInfo(totalPoints);

  const leaderboard = allUsers
    .map((u) => {
      const points = u.pointEvents.reduce((sum, e) => sum + e.points, 0);
      return { id: u.id, name: u.name, tier: tierForPoints(points), points };
    })
    .sort((a, b) => b.points - a.points)
    .map((row, i) => ({ ...row, rank: i + 1 }));

  return (
    <AexDashboard
      tier={tier}
      points={totalPoints}
      nextTier={nextTier}
      pointsToNextTier={pointsToNextTier}
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