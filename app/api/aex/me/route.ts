import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { tierForPoints, nextTierInfo } from "@/lib/aexTransform";
import { getAexConfig } from "@/lib/aexConfig";
import { formatRelativeTime } from "@/lib/leadTransform";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getOrCreateCurrentUser(session);

  const [pointEvents, badges, streaks, pointsAgg, aexConfig] = await Promise.all([
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
    getAexConfig(),
  ]);

  const totalPoints = pointsAgg._sum.points ?? 0;
  const tier = tierForPoints(totalPoints, aexConfig.tierThresholds);
  const { nextTier, pointsToNextTier } = nextTierInfo(totalPoints, aexConfig.tierThresholds);

  return NextResponse.json({
    tier,
    points: totalPoints,
    nextTier,
    pointsToNextTier,
    pointEvents: pointEvents.map((e) => ({
      id: e.id,
      label: e.label,
      points: e.points,
      timestamp: formatRelativeTime(e.createdAt),
    })),
    badges: badges.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      earned: true,
    })),
    streaks: streaks.map((s) => ({
      id: s.id,
      label: s.label,
      currentCount: s.currentCount,
      resetRule: s.resetRule,
    })),
  });
}