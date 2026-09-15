import { prisma } from "./prisma";
import { leadStageRank } from "./leadData";

// PRD AE07 (Lead Scoring and Prioritisation). Previously `Lead.score` was
// set once at creation and never touched again — this is the real
// recalculation engine, called whenever real behaviour changes (an
// interaction gets logged, or the stage changes — see the call sites in
// app/api/leads/[id]/interactions/route.ts and app/api/leads/[id]/route.ts).
//
// PLACEHOLDER WEIGHTS/BANDS — not business-approved, same governance
// pattern as lib/productivityIndex.ts and lib/aexTransform.ts. Each
// dimension is explainable in one sentence per the general explainability
// rule (JN14 / "top contributing factors" in AE07's own output spec).

const CONTACT_TYPES = new Set(["call", "email", "meeting"]);

// Derived from the real Salesforce-status rank order (lib/leadData.ts)
// rather than a hand-listed 5-value map, so every real status
// contributes points proportional to how far it's progressed. Capped at
// 25 to match this dimension's original max weight.
function stagePointsFor(stage: string): number {
  const rank = leadStageRank[stage] ?? 0;
  if (rank < 0) return 0; // Not Interested / Cancelled / Remove from DB
  return Math.min(25, rank * 3);
}

const ENGAGEMENT_POINTS: Record<string, number> = {
  High: 10,
  Medium: 5,
  Low: 0,
};

// PRD AE07 — "source quality" factor. PLACEHOLDER ranking (not
// business-approved, same governance note as the rest of this file) —
// direct/referral-style sources outrank paid-ad sources as a starting
// assumption pending real conversion-rate-by-source data.
const SOURCE_QUALITY_POINTS: Record<string, number> = {
  Salesforce: 10,
  "HubSpot — Landing Page": 8,
  "HubSpot — Chat": 8,
  "Google Ads": 5,
  "Meta Ads": 5,
};
const DEFAULT_SOURCE_QUALITY_POINTS = 5;

export type ScoreFactor = { label: string; points: number };

export type LeadScoreResult = {
  score: number;
  topFactor: ScoreFactor;
  factors: ScoreFactor[];
};

function speedToContactPoints(hours: number | null): { points: number; label: string } {
  if (hours === null) return { points: 0, label: "Not yet contacted" };
  if (hours <= 1) return { points: 25, label: "Contacted within an hour of creation" };
  if (hours <= 4) return { points: 20, label: `Contacted within ${hours.toFixed(1)}h of creation` };
  if (hours <= 24) return { points: 12, label: `Contacted within ${hours.toFixed(1)}h of creation` };
  if (hours <= 72) return { points: 6, label: `Contacted after ${hours.toFixed(1)}h — slow response` };
  return { points: 0, label: "Contacted after 72h+ — very slow response" };
}

function recencyPoints(referenceDate: Date): { points: number; label: string } {
  const days = (Date.now() - referenceDate.getTime()) / 86_400_000;
  if (days <= 1) return { points: 20, label: "Active within the last day" };
  if (days <= 3) return { points: 14, label: `${Math.round(days)} days since last activity` };
  if (days <= 7) return { points: 8, label: `${Math.round(days)} days since last activity` };
  if (days <= 14) return { points: 3, label: `${Math.round(days)} days since last activity — going cold` };
  return { points: 0, label: `${Math.round(days)} days since last activity — inactive` };
}

/**
 * Recomputes a lead's score from its real timeline/stage/engagement data.
 * Does not persist — callers decide when to write it (see leadScoring
 * usage in the interactions and lead PATCH routes).
 */
export async function calculateLeadScore(leadId: string): Promise<LeadScoreResult> {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { timelineEvents: { orderBy: { occurredAt: "asc" } } },
  });

  const factors: ScoreFactor[] = [];

  const firstContact = lead.timelineEvents.find((e) => CONTACT_TYPES.has(e.type));
  const speedHours = firstContact
    ? (firstContact.occurredAt.getTime() - lead.createdAt.getTime()) / 3_600_000
    : null;
  const speed = speedToContactPoints(speedHours);
  factors.push({ label: speed.label, points: speed.points });

  const contactCount = lead.timelineEvents.filter((e) => CONTACT_TYPES.has(e.type)).length;
  const frequencyPoints = Math.min(20, contactCount * 5);
  factors.push({
    label: `${contactCount} logged interaction${contactCount === 1 ? "" : "s"}`,
    points: frequencyPoints,
  });

  const stagePoints = stagePointsFor(lead.stage);
  factors.push({ label: `Currently at ${lead.stage} stage`, points: stagePoints });

  const recency = recencyPoints(lead.lastInteractionAt ?? lead.createdAt);
  factors.push({ label: recency.label, points: recency.points });

  const engagementPts = ENGAGEMENT_POINTS[lead.engagement] ?? 0;
  factors.push({ label: `${lead.engagement} engagement`, points: engagementPts });

  const sourceQualityPts = SOURCE_QUALITY_POINTS[lead.source] ?? DEFAULT_SOURCE_QUALITY_POINTS;
  factors.push({ label: `${lead.source} source quality`, points: sourceQualityPts });

  const score = Math.min(
    100,
    Math.round(
      speed.points + frequencyPoints + stagePoints + recency.points + engagementPts + sourceQualityPts
    )
  );

  const topFactor = [...factors].sort((a, b) => b.points - a.points)[0];

  return { score, topFactor, factors };
}

/** Recalculates and persists a lead's score + prioritization reason. */
export async function recalculateLeadScore(leadId: string): Promise<LeadScoreResult> {
  const result = await calculateLeadScore(leadId);
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      score: result.score,
      prioritizationReason: `${result.topFactor.label} (+${result.topFactor.points} pts)`,
    },
  });
  return result;
}
