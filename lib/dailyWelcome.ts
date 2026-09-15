import { prisma } from "./prisma";
import { getVisibleTargets, calculateActual, type TargetMetric } from "./targetTracker";
import { tierForPoints, nextTierInfo } from "./aexTransform";
import { getAexConfig } from "./aexConfig";
import type { Tier } from "./businessActivityData";

// PRD AE01 (Sign In and Welcome Sequence) + AE02 (Yesterday and Target
// Review). Agent-only — Admins land straight in the Command Center.

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// SQL Server can round DateTime values slightly on write, so comparing
// two independently-stored millisecond timestamps for exact equality is
// unreliable — it was causing the welcome sequence to loop forever
// (looked "acknowledged" for a few ms, then immediately not-equal again
// on the very next check). A tolerance window fixes this without losing
// the intent: two sign-ins are only ever the "same" one if their
// timestamps are genuinely close together.
const SIGN_IN_MATCH_TOLERANCE_MS = 5_000;

/**
 * Show if the calendar day has rolled over since last acknowledged
 * (even mid-session, no sign-out required), OR this is a genuinely new
 * sign-in (lib/auth.ts's `signedInAt`, only set when NextAuth authenticates
 * fresh — not on a resumed session).
 */
export function shouldShowWelcome(
  user: { lastWelcomeAckDate: Date | null; lastWelcomeAckSignedInAt: Date | null },
  sessionSignedInAt: number | undefined
): boolean {
  const today = startOfDay(new Date()).getTime();
  const ackDate = user.lastWelcomeAckDate ? startOfDay(user.lastWelcomeAckDate).getTime() : null;
  if (ackDate !== today) return true;

  if (!sessionSignedInAt) return false; // no signal to compare — don't force-show
  const ackSignedInAt = user.lastWelcomeAckSignedInAt?.getTime() ?? null;
  if (ackSignedInAt === null) return true;
  return Math.abs(ackSignedInAt - sessionSignedInAt) > SIGN_IN_MATCH_TOLERANCE_MS;
}

export type YesterdayStats = {
  calls: number;
  meetingsBooked: number;
  meetingsConducted: number;
};

export type WelcomeTargetRow = {
  metric: TargetMetric;
  label: string;
  percentComplete: number;
  status: "Critical" | "Watch" | "Good";
};

export type WelcomePeriod = "weekly" | "monthly" | "yearly";

export type WelcomeData = {
  yesterday: YesterdayStats;
  todayTargets: WelcomeTargetRow[];
  periodTargets: Record<WelcomePeriod, WelcomeTargetRow[]>;
  summary: string[];
};

function statusFor(percentComplete: number, isOnPace: boolean): WelcomeTargetRow["status"] {
  if (!isOnPace && percentComplete < 40) return "Critical";
  if (!isOnPace) return "Watch";
  return "Good";
}

function classifyPeriod(periodStart: Date, periodEnd: Date): WelcomePeriod | null {
  const days = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86_400_000);
  if (days <= 9) return "weekly";
  if (days <= 45) return "monthly";
  if (days <= 400) return "yearly";
  return null;
}

const METRIC_LABELS: Record<TargetMetric, string> = {
  revenue: "Sales Target",
  calls: "Calls",
  meetings: "Meetings",
};

export async function getWelcomeData(userId: string, teamId: string | null): Promise<WelcomeData> {
  const now = new Date();
  const yesterdayStart = startOfDay(new Date(now.getTime() - 86_400_000));
  const yesterdayEnd = startOfDay(now);

  const [callsCount, meetingsBookedCount, meetingsConductedCount, targets] = await Promise.all([
    prisma.leadTimelineEvent.count({
      where: {
        lead: { assignedUserId: userId },
        type: "call",
        occurredAt: { gte: yesterdayStart, lt: yesterdayEnd },
      },
    }),
    prisma.leadTimelineEvent.count({
      where: {
        lead: { assignedUserId: userId },
        type: "stage_change",
        summary: { contains: "Meeting Booked" },
        occurredAt: { gte: yesterdayStart, lt: yesterdayEnd },
      },
    }),
    prisma.leadTimelineEvent.count({
      where: {
        lead: { assignedUserId: userId },
        type: "meeting",
        occurredAt: { gte: yesterdayStart, lt: yesterdayEnd },
      },
    }),
    getVisibleTargets(userId, teamId),
  ]);

  const personalTargets = targets.filter((t) => !t.isTeamTarget);

  const todayTargets: WelcomeTargetRow[] = personalTargets.map((t) => ({
    metric: t.metric,
    label: METRIC_LABELS[t.metric],
    percentComplete: t.percentComplete,
    status: statusFor(t.percentComplete, t.isOnPace),
  }));

  const periodTargets: WelcomeData["periodTargets"] = { weekly: [], monthly: [], yearly: [] };
  for (const t of personalTargets) {
    const period = classifyPeriod(new Date(t.periodStart), new Date(t.periodEnd));
    if (period) {
      periodTargets[period].push({
        metric: t.metric,
        label: METRIC_LABELS[t.metric],
        percentComplete: t.percentComplete,
        status: statusFor(t.percentComplete, t.isOnPace),
      });
    }
  }

  const summary = todayTargets.map((t) => `${t.label} ${t.status}`);

  return {
    yesterday: {
      calls: callsCount,
      meetingsBooked: meetingsBookedCount,
      meetingsConducted: meetingsConductedCount,
    },
    todayTargets,
    periodTargets,
    summary,
  };
}

export async function acknowledgeWelcome(
  userId: string,
  sessionSignedInAt: number | undefined
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      lastWelcomeAckDate: startOfDay(new Date()),
      lastWelcomeAckSignedInAt: sessionSignedInAt ? new Date(sessionSignedInAt) : null,
    },
  });
}

function formatMetricValue(metric: TargetMetric, value: number): string {
  if (metric === "revenue") {
    return value >= 1000 ? `$${(value / 1000).toFixed(1).replace(/\.0$/, "")}k` : `$${Math.round(value)}`;
  }
  return String(Math.round(value));
}

export type TargetComparisonRow = {
  metric: TargetMetric;
  label: string;
  previousPercent: number;
  previousValue: string;
  newPercent: number;
  newValue: string;
  isDecline: boolean;
};

/**
 * "Previous vs new target" comparison (TargetAcceptance screen) — real,
 * derived from actual past Target rows for the same metric, not
 * fabricated numbers. "Previous" is what was actually achieved against
 * the most recent past target of that metric; "new" is the current
 * target's goal and how far into it the agent already is.
 */
export async function getTargetComparison(
  userId: string,
  teamId: string | null
): Promise<TargetComparisonRow[]> {
  const targets = await getVisibleTargets(userId, teamId);
  const personalTargets = targets.filter((t) => !t.isTeamTarget);

  const rows: TargetComparisonRow[] = [];
  for (const t of personalTargets) {
    const prevTarget = await prisma.target.findFirst({
      where: {
        userId,
        metric: t.metric,
        periodEnd: { lt: new Date(t.periodStart) },
      },
      orderBy: { periodEnd: "desc" },
    });

    let previousPercent = 0;
    let previousValue = "—";
    if (prevTarget) {
      const prevActual = await calculateActual(
        t.metric,
        [userId],
        prevTarget.periodStart,
        prevTarget.periodEnd
      );
      previousPercent =
        prevTarget.targetValue > 0 ? Math.round((prevActual / prevTarget.targetValue) * 100) : 0;
      previousValue = formatMetricValue(t.metric as TargetMetric, prevActual);
    }

    rows.push({
      metric: t.metric,
      label: METRIC_LABELS[t.metric],
      previousPercent,
      previousValue,
      newPercent: t.percentComplete,
      newValue: formatMetricValue(t.metric, t.targetValue),
      isDecline: t.percentComplete < previousPercent,
    });
  }

  return rows;
}

export type TierProgress = {
  tier: Tier;
  points: number;
  nextTier: Tier | null;
  pointsToNextTier: number;
};

export async function getTierProgress(userId: string): Promise<TierProgress> {
  const [pointEvents, config] = await Promise.all([
    prisma.aexPointEvent.findMany({ where: { userId } }),
    getAexConfig(),
  ]);
  const points = pointEvents.reduce((sum, e) => sum + e.points, 0);
  const tier = tierForPoints(points, config.tierThresholds);
  const { nextTier, pointsToNextTier } = nextTierInfo(points, config.tierThresholds);
  return { tier, points, nextTier, pointsToNextTier };
}
