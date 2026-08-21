// Placeholder data only. Replace with a real AEX leaderboard API call
// (e.g. GET /api/aex/leaderboard) once the AEX event/point engine is built.

export type LeaderboardEntry = {
  id: string;
  name: string;
  revenue: number;
};

export const leaderboardData: LeaderboardEntry[] = [
  { id: "a1", name: "Agent 1", revenue: 3_800_000 },
  { id: "a2", name: "Agent 2", revenue: 3_500_000 },
  { id: "a3", name: "Agent 3", revenue: 3_200_000 },
  { id: "a4", name: "Agent 4", revenue: 2_900_000 },
  { id: "a5", name: "Agent 5", revenue: 2_100_000 },
  { id: "a6", name: "Agent 6", revenue: 1_900_000 },
  { id: "a7", name: "Agent 7", revenue: 1_300_000 },
  { id: "a8", name: "Agent 8", revenue: 1_100_000 },
  { id: "a9", name: "Agent 9", revenue: 900_000 },
  { id: "a10", name: "Agent 10", revenue: 865_000 },
];

export function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value}`;
}
