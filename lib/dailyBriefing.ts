import { prisma } from "./prisma";
import { getMissionItems } from "./missionCentre";
import { tierForPoints, nextTierInfo } from "./aexTransform";
import { getAexConfig } from "./aexConfig";
import { calculateProductivityIndex } from "./productivityIndex";
import { askJanus } from "./janus";

// PRD JN03 (Daily and Weekly Briefings). Extracted from
// app/api/janus/briefing/route.ts so both that endpoint (used by the
// Command Center's DailyBriefing widget) and the /onboarding sequence's
// YesterdayTargetReview screen can call the same real logic directly,
// without one server component making an HTTP round-trip to the other's
// API route.

const DAILY_PROMPT = `You are Janus, opening Sphaera for a sales agent at the start of their day.

Rules:
- Only use the data provided in this conversation as ground truth. Never invent facts, numbers, or client details not present in the provided context.
- Structure your answer as a short, energising briefing: 1) today's top priority, 2) what needs attention (overdue items), 3) one specific coaching tip drawn from the data given.
- Keep it to 3-4 short sentences — this is read in the first seconds of the day.
- Never invent or imply a price, discount, or legal commitment.`;

const WEEKLY_PROMPT = `You are Janus, giving a sales agent their weekly rollup inside Sphaera.

Rules:
- Only use the data provided in this conversation as ground truth. Never invent facts, numbers, or client details not present in the provided context.
- Structure your answer as: 1) how the week went overall (points/activity trend), 2) what's still outstanding right now, 3) one specific coaching tip for the week ahead.
- Keep it to 4-5 sentences — this is a weekly check-in, not a report.
- Never invent or imply a price, discount, or legal commitment.`;

export type BriefingPeriod = "day" | "week";

export type DailyBriefingData = {
  briefing: string;
  missionCount: number;
  overdueCount: number;
  tier: string;
  points: number;
  streakDays: number;
};

export async function getDailyBriefingData(
  userId: string,
  period: BriefingPeriod = "day"
): Promise<DailyBriefingData> {
  const windowStart = new Date();
  if (period === "week") {
    windowStart.setDate(windowStart.getDate() - 7);
  } else {
    windowStart.setHours(0, 0, 0, 0);
  }

  const [missionItems, topLeads, pointEvents, streak, productivity, aexConfig] = await Promise.all([
    getMissionItems(userId),
    prisma.lead.findMany({
      where: { assignedUserId: userId },
      orderBy: { score: "desc" },
      take: 3,
    }),
    prisma.aexPointEvent.findMany({
      where: { userId, createdAt: { gte: windowStart } },
    }),
    prisma.userStreak.findFirst({
      where: { userId, label: "Daily mission completion" },
    }),
    calculateProductivityIndex(userId),
    getAexConfig(),
  ]);

  const points = pointEvents.reduce((sum, e) => sum + e.points, 0);
  const tier = tierForPoints(points, aexConfig.tierThresholds);
  const { nextTier, pointsToNextTier } = nextTierInfo(points, aexConfig.tierThresholds);

  const weakestDimension = Object.entries(productivity.dimensions).sort(
    (a, b) => a[1].score - b[1].score
  )[0];

  const overdueCount = missionItems.filter(
    (m) => m.type === "overdue_lead" || m.type === "overdue_task"
  ).length;

  const periodLabel = period === "week" ? "the last 7 days" : "today";

  const groundingContext = `
Current mission items (${missionItems.length} total, ${overdueCount} overdue):
${missionItems
  .slice(0, 6)
  .map((m) => `- [${m.urgency}] ${m.title} — ${m.subtitle}`)
  .join("\n") || "- Nothing urgent right now"}

Top 3 highest-scoring leads assigned to this user:
${topLeads.map((l) => `- ${l.name}: score ${l.score}, stage ${l.stage}, reason: ${l.prioritizationReason ?? "none"}`).join("\n") || "- No leads assigned yet"}

AEX status: ${tier} tier, ${points} points earned over ${periodLabel}${nextTier ? `, ${pointsToNextTier} points to ${nextTier}` : " (highest tier reached)"}.
Current daily activity streak: ${streak?.currentCount ?? 0} day(s).

Weakest Productivity Index dimension: ${weakestDimension[0]} (score ${weakestDimension[1].score}/100) — ${weakestDimension[1].detail}.
`.trim();

  const briefing = await askJanus([
    { role: "system", content: period === "week" ? WEEKLY_PROMPT : DAILY_PROMPT },
    { role: "system", content: groundingContext },
    {
      role: "user",
      content: period === "week" ? "Give me my weekly rollup." : "Give me my briefing for today.",
    },
  ]);

  return {
    briefing,
    missionCount: missionItems.length,
    overdueCount,
    tier,
    points,
    streakDays: streak?.currentCount ?? 0,
  };
}
