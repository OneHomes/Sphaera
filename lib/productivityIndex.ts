import { prisma } from "./prisma";

// PLACEHOLDER WEIGHTS/THRESHOLDS — not business-approved. PRD Section
// 14.3 requires Productivity Index weights and thresholds to be
// configurable and signed off by the One Homes business owner before
// UAT. Same governance pattern already used for AEX tier thresholds
// (lib/aexTransform.ts) and allocation caps (lib/allocationRules.ts).
const WEIGHTS = {
  speedToLead: 0.25,
  output: 0.2,
  engagementConversion: 0.2,
  interactionFulfilment: 0.2,
  dataQuality: 0.15,
};

const OUTPUT_WEEKLY_TARGET = 20; // PLACEHOLDER weekly activity target
const FRESHNESS_WINDOW_DAYS = 14; // PLACEHOLDER "actively managed" window

const QUALIFIED_OR_LATER = new Set([
  "Qualified",
  "Meeting Booked",
  "Opportunity",
  "Negotiation",
  "Closed Won",
]);

const CONTACT_EVENT_TYPES = new Set(["call", "email", "meeting"]);

export type ProductivityIndexResult = {
  overall: number;
  dimensions: {
    speedToLead: { score: number; detail: string };
    output: { score: number; detail: string };
    engagementConversion: { score: number; detail: string };
    interactionFulfilment: { score: number; detail: string };
    dataQuality: { score: number; detail: string };
  };
};

// Discrete bands (rather than a continuous formula) so each score stays
// easy to explain in one sentence — matching the general explainability
// rule (JN14): every score must be able to say why.
function speedToLeadScore(avgHours: number | null): number {
  if (avgHours === null) return 100; // no leads yet -- nothing to measure
  if (avgHours <= 1) return 100;
  if (avgHours <= 4) return 80;
  if (avgHours <= 24) return 60;
  if (avgHours <= 72) return 40;
  return 20;
}

/**
 * Computes a real Productivity Index for a user from their actual
 * Lead/LeadTimelineEvent/Task data — five dimensions per PRD Section 5.3,
 * each independently explainable, combined via the placeholder weights
 * above.
 */
export async function calculateProductivityIndex(
  userId: string
): Promise<ProductivityIndexResult> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3_600_000);

  const [leads, tasks, recentContactEvents] = await Promise.all([
    prisma.lead.findMany({
      where: { assignedUserId: userId },
      include: {
        timelineEvents: { orderBy: { occurredAt: "asc" } },
      },
    }),
    prisma.task.findMany({ where: { assignedToId: userId } }),
    prisma.leadTimelineEvent.findMany({
      where: {
        lead: { assignedUserId: userId },
        occurredAt: { gte: sevenDaysAgo },
        type: { in: ["call", "email", "meeting"] },
      },
    }),
  ]);

  // ---- 1. Speed to Lead: time from lead creation to first logged contact ----
  const speedSamples: number[] = [];
  for (const lead of leads) {
    const firstContact = lead.timelineEvents.find((e) =>
      CONTACT_EVENT_TYPES.has(e.type)
    );
    if (firstContact) {
      const hours =
        (firstContact.occurredAt.getTime() - lead.createdAt.getTime()) /
        3_600_000;
      speedSamples.push(Math.max(hours, 0));
    }
  }
  const avgSpeedHours =
    speedSamples.length > 0
      ? speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length
      : null;
  const speedScore = speedToLeadScore(avgSpeedHours);

  // ---- 2. Output: activity volume in the last 7 days ----
  const completedTasksLast7Days = tasks.filter(
    (t) => t.completed && t.updatedAt.getTime() > sevenDaysAgo.getTime()
  ).length;
  const outputCount = recentContactEvents.length + completedTasksLast7Days;
  const outputScore = Math.min(
    100,
    Math.round((outputCount / OUTPUT_WEEKLY_TARGET) * 100)
  );

  // ---- 3. Engagement Conversion: leads progressed past New/Contacted ----
  const qualifiedCount = leads.filter((l) =>
    QUALIFIED_OR_LATER.has(l.stage)
  ).length;
  const engagementScore =
    leads.length > 0 ? Math.round((qualifiedCount / leads.length) * 100) : 100;

  // ---- 4. Interaction Fulfilment: task completion rate ----
  const completedTasks = tasks.filter((t) => t.completed).length;
  const fulfilmentScore =
    tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 100;

  // ---- 5. Data Quality: leads that are actively documented ----
  const freshWellDocumented = leads.filter((l) => {
    const hasNextAction = Boolean(l.nextAction);
    const isFresh =
      l.lastInteractionAt !== null &&
      Date.now() - l.lastInteractionAt.getTime() 
        FRESHNESS_WINDOW_DAYS * 24 * 3_600_000;
    return hasNextAction && isFresh;
  }).length;
  const dataQualityScore =
    leads.length > 0
      ? Math.round((freshWellDocumented / leads.length) * 100)
      : 100;

  const overall = Math.round(
    speedScore * WEIGHTS.speedToLead +
      outputScore * WEIGHTS.output +
      engagementScore * WEIGHTS.engagementConversion +
      fulfilmentScore * WEIGHTS.interactionFulfilment +
      dataQualityScore * WEIGHTS.dataQuality
  );

  return {
    overall,
    dimensions: {
      speedToLead: {
        score: speedScore,
        detail:
          avgSpeedHours !== null
            ? `Avg ${avgSpeedHours.toFixed(1)}h to first contact`
            : "No leads to measure yet",
      },
      output: {
        score: outputScore,
        detail: `${outputCount} activities in the last 7 days`,
      },
      engagementConversion: {
        score: engagementScore,
        detail: `${qualifiedCount}/${leads.length} leads qualified or further`,
      },
      interactionFulfilment: {
        score: fulfilmentScore,
        detail: `${completedTasks}/${tasks.length} tasks completed`,
      },
      dataQuality: {
        score: dataQualityScore,
        detail: `${freshWellDocumented}/${leads.length} leads actively documented`,
      },
    },
  };
}