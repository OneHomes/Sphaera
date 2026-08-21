// Placeholder data only. Real version reads from the Productivity Index,
// Target, and Janus briefing entities once live (PRD AE01 — Sign In and
// Welcome Sequence, AE02 — Yesterday and Target Review, AE03 — MindState
// Check In). Sequence must complete in under two minutes per AE01
// acceptance criteria — keep each step lightweight.

export const welcomeQuote = {
  eyebrow: "Everyone has the will to win, but very few have the will to prepare to win...",
  headline: "Welcome back, Agent 1. Let's get this day started.",
};

export const missionQuote = {
  eyebrow: "Winners focus on winning, losers focus on winners...",
  headline: "Our goal is to get 15 qualified leads today",
};

export type MetricBar = {
  label: string;
  percent: number;
  colorClass: string;
};

export const yesterdayMetrics: MetricBar[] = [
  { label: "Productivity", percent: 63, colorClass: "bg-status-active" },
  { label: "Collections", percent: 24, colorClass: "bg-status-inactive" },
  { label: "Calls", percent: 75, colorClass: "bg-status-active" },
  { label: "Meetings Booked", percent: 100, colorClass: "bg-status-active" },
  { label: "Meetings Conducted", percent: 65, colorClass: "bg-status-alert" },
];

export const weeklyTargetMetrics: MetricBar[] = [
  { label: "Sales Target", percent: 33, colorClass: "bg-status-inactive" },
  { label: "Collections", percent: 51, colorClass: "bg-status-alert" },
  { label: "Calls", percent: 75, colorClass: "bg-status-active" },
  { label: "Meetings Booked", percent: 100, colorClass: "bg-status-active" },
  { label: "Meetings Conducted", percent: 23, colorClass: "bg-status-inactive" },
];

export const weeklySummary = [
  "Sales target Critical",
  "Collections Average",
  "Calls Good",
  "Meetings Conducted Good",
  "Agents Onboarded Critical",
];

export const janusYesterdayInsight =
  "You showed good productivity yesterday, particularly in calls and meetings. However, there were noticeable periods of inactivity where your status was not updated, which affects accurate tracking. To improve focus and output today, I've scheduled a structured day for you. Please click the Today's Targets tab to accept today's plan. We'll be using the Manchester county leads campaign, which is performing well and from which you've already closed two deals. There are also five leads which are following the buying partner displayed by previous deals you have closed.";

export type TargetComparisonRow = {
  label: string;
  icon: "collections" | "calls" | "meetingsBooked" | "meetingsConducted" | "productivity";
  previousPercent: number;
  previousValue: string;
  newPercent: number;
  newValue: string;
  isDecline?: boolean;
};

export const todayTargetComparison: TargetComparisonRow[] = [
  { label: "Collections", icon: "collections", previousPercent: 50, previousValue: "$50k", newPercent: 75, newValue: "$75k" },
  { label: "Calls", icon: "calls", previousPercent: 100, previousValue: "130", newPercent: 150, newValue: "195" },
  { label: "Meetings Booked", icon: "meetingsBooked", previousPercent: 70, previousValue: "4", newPercent: 50, newValue: "2", isDecline: true },
  { label: "Meetings Conducted", icon: "meetingsConducted", previousPercent: 70, previousValue: "4", newPercent: 120, newValue: "3" },
  { label: "Productivity", icon: "productivity", previousPercent: 80, previousValue: "80", newPercent: 55, newValue: "2%", isDecline: true },
];

export type TierName = "Gold" | "Silver" | "Bronze";

export const tierSequence: TierName[] = ["Gold", "Silver", "Bronze", "Silver", "Gold"];

export type RoadToSuccessItem = {
  label: string;
  target: string;
  points: number;
};

export const roadToSuccessItems: RoadToSuccessItem[] = [
  { label: "Collections", target: "$7.5k Collections", points: 20 },
  { label: "Calls", target: "195 Calls", points: 15 },
  { label: "Meetings Booked", target: "2 Meetings Booked", points: 15 },
  { label: "Meetings Conducted", target: "6 Meetings Conducted", points: 20 },
  { label: "Productivity", target: "80% Productivity", points: 30 },
];

export const nextTierUnlocks = [
  "Tier 2 lead quality classification",
  "15 minute performance recalibration slot",
  "1 legacy point reward allocation",
  "Access to the Silver lead pool",
];
