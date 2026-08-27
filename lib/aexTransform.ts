import type { Tier } from "@/lib/businessActivityData";

// PLACEHOLDER THRESHOLDS — not business-approved. PRD Section 14.3
// requires Productivity Index/tier weights and thresholds to be
// configurable and signed off by the One Homes business owner before
// UAT. These numbers exist only so the tier progress bar has something
// meaningful to show during development; treat as provisional.
const TIER_THRESHOLDS: { tier: Tier; minPoints: number }[] = [
  { tier: "Bronze", minPoints: 0 },
  { tier: "Silver", minPoints: 500 },
  { tier: "Gold", minPoints: 2000 },
];

export function tierForPoints(points: number): Tier {
  let current: Tier = "Bronze";
  for (const { tier, minPoints } of TIER_THRESHOLDS) {
    if (points >= minPoints) current = tier;
  }
  return current;
}

export function nextTierInfo(
  points: number
): { nextTier: Tier | null; pointsToNextTier: number } {
  const sorted = [...TIER_THRESHOLDS].sort((a, b) => a.minPoints - b.minPoints);
  const next = sorted.find((t) => t.minPoints > points);
  if (!next) return { nextTier: null, pointsToNextTier: 0 };
  return { nextTier: next.tier, pointsToNextTier: next.minPoints - points };
}