import type { Tier } from "@/lib/businessActivityData";
import type { TierThreshold } from "@/lib/aexConfig";

// Fallback used only where a caller hasn't been wired to fetch real
// AexConfig yet — PRD Section 14.3 requires these to be configurable via
// Apex Vision (see lib/aexConfig.ts), not hardcoded. Prefer passing real
// thresholds from getAexConfig() wherever the call site is already async.
export const DEFAULT_TIER_THRESHOLDS: TierThreshold[] = [
  { tier: "Bronze", minPoints: 0 },
  { tier: "Silver", minPoints: 500 },
  { tier: "Gold", minPoints: 2000 },
];

export function tierForPoints(
  points: number,
  thresholds: TierThreshold[] = DEFAULT_TIER_THRESHOLDS
): Tier {
  let current: Tier = "Bronze";
  for (const { tier, minPoints } of thresholds) {
    if (points >= minPoints) current = tier;
  }
  return current;
}

export function nextTierInfo(
  points: number,
  thresholds: TierThreshold[] = DEFAULT_TIER_THRESHOLDS
): { nextTier: Tier | null; pointsToNextTier: number } {
  const sorted = [...thresholds].sort((a, b) => a.minPoints - b.minPoints);
  const next = sorted.find((t) => t.minPoints > points);
  if (!next) return { nextTier: null, pointsToNextTier: 0 };
  return { nextTier: next.tier, pointsToNextTier: next.minPoints - points };
}
