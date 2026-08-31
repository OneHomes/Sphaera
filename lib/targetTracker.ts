import { prisma } from "./prisma";

export type TargetMetric = "revenue" | "calls" | "meetings";

export const TARGET_METRICS: { key: TargetMetric; label: string }[] = [
  { key: "revenue", label: "Revenue (Closed Won)" },
  { key: "calls", label: "Calls Logged" },
  { key: "meetings", label: "Meetings Logged" },
];

export type TargetWithProgress = {
  id: string;
  metric: TargetMetric;
  scopeLabel: string;
  isTeamTarget: boolean;
  periodStart: string;
  periodEnd: string;
  targetValue: number;
  actualValue: number;
  percentComplete: number;
  daysRemaining: number;
  isOnPace: boolean;
};

export async function calculateActual(
  metric: TargetMetric,
  userIds: string[],
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  if (userIds.length === 0) return 0;

  if (metric === "revenue") {
    const opportunities = await prisma.opportunity.findMany({
      where: {
        assignedUserId: { in: userIds },
        stage: "Closed Won",
        updatedAt: { gte: periodStart, lte: periodEnd },
      },
      select: { value: true },
    });
    return opportunities.reduce((sum, o) => sum + o.value, 0);
  }

  // calls / meetings — counted from real LeadTimelineEvent entries
  const count = await prisma.leadTimelineEvent.count({
    where: {
      lead: { assignedUserId: { in: userIds } },
      type: metric === "calls" ? "call" : "meeting",
      occurredAt: { gte: periodStart, lte: periodEnd },
    },
  });
  return count;
}

/**
 * Returns every target currently visible to a user: their own personal
 * targets, plus any target set for their team (team targets are scored
 * against the combined activity of every team member).
 */
export async function getVisibleTargets(
  userId: string,
  teamId: string | null
): Promise<TargetWithProgress[]> {
  const now = new Date();

  const orClauses: Array<{ userId: string } | { teamId: string }> = [
    { userId },
  ];
  if (teamId) orClauses.push({ teamId });

  const targets = await prisma.target.findMany({
    where: {
      OR: orClauses,
      periodStart: { lte: now },
      periodEnd: { gte: now },
    },
    include: { team: { include: { members: true } } },
    orderBy: { periodEnd: "asc" },
  });

  const results: TargetWithProgress[] = [];

  for (const target of targets) {
    const scopeUserIds = target.userId
      ? [target.userId]
      : target.team?.members.map((m) => m.id) ?? [];

    const actualValue = await calculateActual(
      target.metric as TargetMetric,
      scopeUserIds,
      target.periodStart,
      target.periodEnd
    );

    const percentComplete =
      target.targetValue > 0
        ? Math.round((actualValue / target.targetValue) * 100)
        : 0;

    const totalDays = Math.max(
      1,
      Math.round(
        (target.periodEnd.getTime() - target.periodStart.getTime()) /
          86_400_000
      )
    );
    const daysElapsed = Math.max(
      0,
      Math.round((now.getTime() - target.periodStart.getTime()) / 86_400_000)
    );
    const daysRemaining = Math.max(0, totalDays - daysElapsed);
    const expectedPercent = Math.min(
      100,
      Math.round((daysElapsed / totalDays) * 100)
    );

    results.push({
      id: target.id,
      metric: target.metric as TargetMetric,
      scopeLabel: target.userId ? "You" : (target.team?.name ?? "Team"),
      isTeamTarget: !target.userId,
      periodStart: target.periodStart.toISOString(),
      periodEnd: target.periodEnd.toISOString(),
      targetValue: target.targetValue,
      actualValue,
      percentComplete,
      daysRemaining,
      isOnPace: percentComplete >= expectedPercent,
    });
  }

  return results;
}