import { prisma } from "./prisma";
import type { Tier } from "./businessActivityData";

export type TierThreshold = { tier: Tier; minPoints: number };

export type ResolvedAexConfig = {
  id: string;
  tierThresholds: TierThreshold[];
  piWeights: {
    speedToLead: number;
    output: number;
    engagementConversion: number;
    interactionFulfilment: number;
    dataQuality: number;
  };
  maxActiveLeadAssignments: number;
  maxActiveOpportunityAssignments: number;
  goldGateScoreThreshold: number;
  goldGateHours: number;
  dailyClubPointThreshold: number;
};

function resolve(row: {
  id: string;
  tierSilverMinPoints: number;
  tierGoldMinPoints: number;
  piWeightSpeedToLead: number;
  piWeightOutput: number;
  piWeightEngagementConversion: number;
  piWeightInteractionFulfilment: number;
  piWeightDataQuality: number;
  maxActiveLeadAssignments: number;
  maxActiveOpportunityAssignments: number;
  goldGateScoreThreshold: number;
  goldGateHours: number;
  dailyClubPointThreshold: number;
}): ResolvedAexConfig {
  return {
    id: row.id,
    tierThresholds: [
      { tier: "Bronze", minPoints: 0 },
      { tier: "Silver", minPoints: row.tierSilverMinPoints },
      { tier: "Gold", minPoints: row.tierGoldMinPoints },
    ],
    piWeights: {
      speedToLead: row.piWeightSpeedToLead,
      output: row.piWeightOutput,
      engagementConversion: row.piWeightEngagementConversion,
      interactionFulfilment: row.piWeightInteractionFulfilment,
      dataQuality: row.piWeightDataQuality,
    },
    maxActiveLeadAssignments: row.maxActiveLeadAssignments,
    maxActiveOpportunityAssignments: row.maxActiveOpportunityAssignments,
    goldGateScoreThreshold: row.goldGateScoreThreshold,
    goldGateHours: row.goldGateHours,
    dailyClubPointThreshold: row.dailyClubPointThreshold,
  };
}

/**
 * PRD AV10 — single source of truth for every AEX/allocation number that
 * used to be a hardcoded constant (tier thresholds, PI weights,
 * allocation caps, tier-gating and Daily Club thresholds). Self-healing
 * singleton row, same pattern as WhatsAppConfig — created with schema
 * defaults on first read if it doesn't exist yet.
 */
export async function getAexConfig(): Promise<ResolvedAexConfig> {
  const existing = await prisma.aexConfig.findFirst();
  if (existing) return resolve(existing);
  const created = await prisma.aexConfig.create({ data: {} });
  return resolve(created);
}

export async function updateAexConfig(
  patch: Partial<{
    tierSilverMinPoints: number;
    tierGoldMinPoints: number;
    piWeightSpeedToLead: number;
    piWeightOutput: number;
    piWeightEngagementConversion: number;
    piWeightInteractionFulfilment: number;
    piWeightDataQuality: number;
    maxActiveLeadAssignments: number;
    maxActiveOpportunityAssignments: number;
    goldGateScoreThreshold: number;
    goldGateHours: number;
    dailyClubPointThreshold: number;
  }>,
  updatedById: string
): Promise<ResolvedAexConfig> {
  const existing = await prisma.aexConfig.findFirst();
  const row = existing
    ? await prisma.aexConfig.update({
        where: { id: existing.id },
        data: { ...patch, updatedById },
      })
    : await prisma.aexConfig.create({ data: { ...patch, updatedById } });
  return resolve(row);
}

/** Real tier for a user's current point total, using live configured thresholds. */
export async function getUserTier(userId: string): Promise<{ tier: Tier; points: number }> {
  const [config, agg] = await Promise.all([
    getAexConfig(),
    prisma.aexPointEvent.aggregate({ where: { userId }, _sum: { points: true } }),
  ]);
  const points = agg._sum.points ?? 0;
  let tier: Tier = "Bronze";
  for (const t of config.tierThresholds) {
    if (points >= t.minPoints) tier = t.tier;
  }
  return { tier, points };
}
