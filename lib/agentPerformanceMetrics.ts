import { prisma } from "./prisma";
import { getVisibleTargets, calculateActual, type TargetWithProgress } from "./targetTracker";
import { tierForPoints, nextTierInfo } from "./aexTransform";
import { getAexConfig } from "./aexConfig";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export type PerformancePeriod = "week" | "month";

export type HealthCardStats = {
  totalLeads: number;
  totalCallsInPeriod: number;
  totalMeetingsInPeriod: number;
  pipelineValue: number;
  revenueClosedInPeriod: number;
  winRate: number | null; // Closed Won / (Closed Won + Closed Lost), null if no closed deals yet
  periodLabel: string;
};

export type MonthlyStageBreakdown = {
  month: string;
  won: number;
  lost: number;
  expected: number; // open opportunities expected to close in that month
};

export type HourlyPipelinePoint = { hour: string; value: number };

export type TierStatus = {
  points: number;
  tier: "Bronze" | "Silver" | "Gold";
  nextTier: "Bronze" | "Silver" | "Gold" | null;
  pointsToNextTier: number;
};

export type TargetGaugeData = TargetWithProgress & {
  missedStreak: number;
  consideredPastTargets: number;
};

export type AgentPerformanceMetrics = {
  health: HealthCardStats;
  targets: TargetGaugeData[];
  tier: TierStatus;
  monthlyBreakdown: MonthlyStageBreakdown[];
  pipelineByHour: HourlyPipelinePoint[];
};

function hourLabel(hour: number): string {
  return `${hour === 0 ? 12 : hour > 12 ? hour - 12 : hour}${hour < 12 ? "AM" : "PM"}`;
}

/**
 * Looks at the user's past (already-ended) Target rows for this metric,
 * most recent first, and counts how many of them were missed in a row
 * (actual < target at period end) — a real, derivable "at risk" signal
 * rather than an invented one.
 */
async function computeMissedStreak(
  userId: string,
  metric: TargetWithProgress["metric"],
  excludeTargetId: string
): Promise<{ missedStreak: number; consideredPastTargets: number }> {
  const now = new Date();
  const pastTargets = await prisma.target.findMany({
    where: {
      userId,
      metric,
      periodEnd: { lt: now },
      id: { not: excludeTargetId },
    },
    orderBy: { periodEnd: "desc" },
    take: 5,
  });

  let missedStreak = 0;
  for (const target of pastTargets) {
    const actual = await calculateActual(
      metric,
      [userId],
      target.periodStart,
      target.periodEnd
    );
    if (actual < target.targetValue) {
      missedStreak += 1;
    } else {
      break;
    }
  }

  return { missedStreak, consideredPastTargets: pastTargets.length };
}

export async function getAgentPerformanceMetrics(
  userId: string,
  teamId: string | null,
  period: PerformancePeriod = "month"
): Promise<AgentPerformanceMetrics> {
  const now = new Date();
  const monthStart =
    period === "week"
      ? new Date(now.getTime() - 7 * 24 * 3_600_000)
      : new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd =
    period === "week"
      ? now
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const periodLabel = period === "week" ? "This Week" : "This Month";
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3_600_000);

  const [
    totalLeads,
    callsThisMonth,
    meetingsThisMonth,
    myOpportunities,
    pointEvents,
    visibleTargets,
    aexConfig,
  ] = await Promise.all([
    prisma.lead.count({ where: { assignedUserId: userId } }),
    prisma.leadTimelineEvent.count({
      where: {
        lead: { assignedUserId: userId },
        type: "call",
        occurredAt: { gte: monthStart, lte: monthEnd },
      },
    }),
    prisma.leadTimelineEvent.count({
      where: {
        lead: { assignedUserId: userId },
        type: "meeting",
        occurredAt: { gte: monthStart, lte: monthEnd },
      },
    }),
    prisma.opportunity.findMany({ where: { assignedUserId: userId } }),
    prisma.aexPointEvent.findMany({ where: { userId } }),
    getVisibleTargets(userId, teamId),
    getAexConfig(),
  ]);

  // ---- Health Card ----
  const pipelineValue = myOpportunities
    .filter((o) => o.stage !== "Closed Won" && o.stage !== "Closed Lost")
    .reduce((sum, o) => sum + o.value, 0);

  const revenueClosedThisMonth = myOpportunities
    .filter(
      (o) =>
        o.stage === "Closed Won" &&
        o.updatedAt >= monthStart &&
        o.updatedAt <= monthEnd
    )
    .reduce((sum, o) => sum + o.value, 0);

  const closedWonCount = myOpportunities.filter((o) => o.stage === "Closed Won").length;
  const closedLostCount = myOpportunities.filter((o) => o.stage === "Closed Lost").length;
  const closedTotal = closedWonCount + closedLostCount;
  const winRate = closedTotal > 0 ? Math.round((closedWonCount / closedTotal) * 100) : null;

  // ---- Weekly/period target gauges — personal targets only, real
  // missed-streak computed per metric from past Target rows ----
  const personalTargets = visibleTargets.filter((t) => !t.isTeamTarget);
  const targets: TargetGaugeData[] = await Promise.all(
    personalTargets.map(async (t) => {
      const { missedStreak, consideredPastTargets } = await computeMissedStreak(
        userId,
        t.metric,
        t.id
      );
      return { ...t, missedStreak, consideredPastTargets };
    })
  );

  // ---- Tier status — real AEX points, placeholder thresholds per PRD 14.3 ----
  const points = pointEvents.reduce((sum, e) => sum + e.points, 0);
  const tier = tierForPoints(points, aexConfig.tierThresholds);
  const { nextTier, pointsToNextTier } = nextTierInfo(points, aexConfig.tierThresholds);

  // ---- Monthly stage breakdown (Won / Lost / Expected-to-close), current year ----
  const currentYear = now.getFullYear();
  const won = new Array(12).fill(0);
  const lost = new Array(12).fill(0);
  const expected = new Array(12).fill(0);
  for (const o of myOpportunities) {
    if (o.stage === "Closed Won" && o.updatedAt.getFullYear() === currentYear) {
      won[o.updatedAt.getMonth()] += o.value;
    } else if (o.stage === "Closed Lost" && o.updatedAt.getFullYear() === currentYear) {
      lost[o.updatedAt.getMonth()] += o.value;
    } else if (
      o.stage !== "Closed Won" &&
      o.stage !== "Closed Lost" &&
      o.expectedCloseAt &&
      o.expectedCloseAt.getFullYear() === currentYear
    ) {
      expected[o.expectedCloseAt.getMonth()] += o.value;
    }
  }
  const monthlyBreakdown: MonthlyStageBreakdown[] = MONTH_LABELS.map((month, i) => ({
    month,
    won: won[i],
    lost: lost[i],
    expected: expected[i],
  }));

  // ---- Pipeline $ activity by hour (last 30 days), from opportunities
  // touched (updatedAt) in that window — a real signal of when this
  // agent's pipeline actually moves, not a fabricated one. ----
  const recentlyTouched = myOpportunities.filter((o) => o.updatedAt >= thirtyDaysAgo);
  const hourTotals = new Array(24).fill(0);
  for (const o of recentlyTouched) {
    hourTotals[o.updatedAt.getHours()] += o.value;
  }
  const pipelineByHour: HourlyPipelinePoint[] = hourTotals.map((value, hour) => ({
    hour: hourLabel(hour),
    value,
  }));

  return {
    health: {
      totalLeads,
      totalCallsInPeriod: callsThisMonth,
      totalMeetingsInPeriod: meetingsThisMonth,
      pipelineValue,
      revenueClosedInPeriod: revenueClosedThisMonth,
      winRate,
      periodLabel,
    },
    targets,
    tier: { points, tier, nextTier, pointsToNextTier },
    monthlyBreakdown,
    pipelineByHour,
  };
}
