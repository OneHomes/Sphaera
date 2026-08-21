import type { Tier } from "@/lib/businessActivityData";

// Placeholder data only. Real version reads from the AEX event/point
// engine (PRD Section 14) once verified system events (calls, meetings,
// stage changes) feed into it — see Sphaera_MVP_Build_Specification.md
// Section 8 for the full AEX requirements this maps to.

export type PointEvent = {
  id: string;
  label: string;
  points: number;
  timestamp: string;
};

export const pointsHistory: PointEvent[] = [
  { id: "pe1", label: "Meeting conducted — Theodore Vance", points: 40, timestamp: "Today, 5:30 PM" },
  { id: "pe2", label: "Connected call — Evelyn Hayes", points: 15, timestamp: "Today, 3:05 PM" },
  { id: "pe3", label: "Lead accepted within service level", points: 10, timestamp: "Today, 11:20 AM" },
  { id: "pe4", label: "Complete data entry bonus", points: 5, timestamp: "Yesterday, 6:00 PM" },
  { id: "pe5", label: "Opportunity progressed — Priya Anand", points: 25, timestamp: "Yesterday, 2:15 PM" },
];

export type Badge = {
  id: string;
  name: string;
  description: string;
  earned: boolean;
};

export const badges: Badge[] = [
  { id: "b1", name: "Speed to Lead", description: "Contacted 10 leads within 60 minutes", earned: true },
  { id: "b2", name: "Meeting Master", description: "Conducted 20 meetings this month", earned: true },
  { id: "b3", name: "Data Quality Champion", description: "100% complete records for 2 weeks straight", earned: true },
  { id: "b4", name: "Closer of the Week", description: "Highest closed value this week", earned: false },
  { id: "b5", name: "Consistency Streak", description: "7-day daily mission completion streak", earned: false },
  { id: "b6", name: "Referral Champion", description: "3 approved referrals converted", earned: false },
];

export type Streak = {
  id: string;
  label: string;
  currentCount: number;
  resetRule: string;
};

export const streaks: Streak[] = [
  { id: "s1", label: "Daily service level achievement", currentCount: 6, resetRule: "Resets if a lead is missed inside the speed-to-lead window" },
  { id: "s2", label: "Daily mission completion", currentCount: 4, resetRule: "Resets at midnight if the day's mission isn't completed" },
];

export type Challenge = {
  id: string;
  title: string;
  metric: string;
  progress: number;
  target: number;
  endsIn: string;
};

export const challenges: Challenge[] = [
  { id: "c1", title: "Connected Calls Sprint", metric: "connected calls", progress: 34, target: 50, endsIn: "3 days" },
  { id: "c2", title: "Meeting Booker", metric: "meetings booked", progress: 7, target: 10, endsIn: "5 days" },
];

export type LeaderboardRow = {
  rank: number;
  name: string;
  tier: Tier;
  points: number;
  pi: number;
};

export const leaderboard: LeaderboardRow[] = [
  { rank: 1, name: "Agent 1", tier: "Gold", points: 3_800, pi: 70 },
  { rank: 2, name: "Agent 2", tier: "Gold", points: 3_500, pi: 69 },
  { rank: 3, name: "Agent 3", tier: "Gold", points: 3_200, pi: 68 },
  { rank: 4, name: "Agent 4", tier: "Gold", points: 2_900, pi: 60 },
  { rank: 5, name: "Agent 5", tier: "Silver", points: 2_100, pi: 49 },
  { rank: 6, name: "Agent 6", tier: "Silver", points: 1_900, pi: 47 },
  { rank: 7, name: "Agent 7", tier: "Silver", points: 1_300, pi: 46 },
  { rank: 8, name: "Agent 9", tier: "Bronze", points: 900, pi: 38 },
  { rank: 9, name: "Agent 10", tier: "Bronze", points: 865, pi: 37 },
];

export const currentUserProgress = {
  tier: "Silver" as Tier,
  points: 2_100,
  pointsToNextTier: 900,
  nextTier: "Gold" as Tier,
};
