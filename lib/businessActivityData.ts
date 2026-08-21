// Placeholder data only — this whole module is UI wiring ahead of real
// data. Per the feasibility analysis already done on the reference
// screenshot (Business Activity, PRD AV02):
//
//  - Agent status/tier/pipeline/revenue/PI: buildable now once Gold data
//    is validated (see Sphaera_MVP_Build_Specification.md Section 5.1).
//  - "Live Activity" (In call / Idle / etc.) needs real-time presence from
//    telephony/messaging providers — not all providers expose this
//    cleanly. Treat as approximate until confirmed (Section 5.3).
//  - Auto-generated "Context" one-liners are an LLM summarization task
//    (Janus, via Azure AI Foundry) and depend on call transcription data
//    actually existing — currently blocked by the Lexatel pipeline issue
//    noted in the Fabric audit. Hardcoded here for UI purposes only.
//  - "BPM" score on leads is an undefined metric in the PRD — flagged for
//    business clarification, NOT implemented as a real calculation here.

export type AgentStatus = "Active" | "Inactive";
export type Tier = "Gold" | "Silver" | "Bronze";
export type TrendDirection = "up" | "down" | "flat";

export type AgentActivityRow = {
  name: string;
  status: AgentStatus;
  tier: Tier;
  pipelineValue: number;
  totalRevenue: number;
  pi: number;
  liveActivity: string;
  liveActivityTrend: TrendDirection;
  context: string;
  team: string;
};

export const agentActivity: AgentActivityRow[] = [
  { name: "Agent 1", status: "Active", tier: "Gold", pipelineValue: 77_000.24, totalRevenue: 84_500.5, pi: 70, liveActivity: "Zoom Meeting", liveActivityTrend: "up", context: "Manchester property investment", team: "Team A" },
  { name: "Agent 2", status: "Active", tier: "Gold", pipelineValue: 72_000.44, totalRevenue: 78_230.2, pi: 69, liveActivity: "In call", liveActivityTrend: "up", context: "Interest rates & mortgages", team: "Team A" },
  { name: "Agent 3", status: "Active", tier: "Gold", pipelineValue: 72_000.41, totalRevenue: 91_700.2, pi: 68, liveActivity: "In call", liveActivityTrend: "up", context: "Introducing company", team: "Team A" },
  { name: "Agent 4", status: "Active", tier: "Gold", pipelineValue: 140_000.15, totalRevenue: 132_460.8, pi: 60, liveActivity: "Email", liveActivityTrend: "flat", context: "Proposal for Dubai investment", team: "Team B" },
  { name: "Agent 5", status: "Active", tier: "Silver", pipelineValue: 150_000.15, totalRevenue: 167_900.4, pi: 49, liveActivity: "Whatsapp", liveActivityTrend: "up", context: "Follow up with Mr. John Jones", team: "Team B" },
  { name: "Agent 6", status: "Active", tier: "Silver", pipelineValue: 220_000.24, totalRevenue: 215_800.7, pi: 47, liveActivity: "Idle", liveActivityTrend: "down", context: "Lunch break", team: "Team B" },
  { name: "Agent 7", status: "Active", tier: "Silver", pipelineValue: 175_000.24, totalRevenue: 189_600.1, pi: 46, liveActivity: "Idle", liveActivityTrend: "down", context: "Lunch break", team: "Team B" },
  { name: "Agent 9", status: "Inactive", tier: "Bronze", pipelineValue: 140_000.15, totalRevenue: 148_100.3, pi: 38, liveActivity: "—", liveActivityTrend: "down", context: "No activity", team: "Team C" },
  { name: "Agent 10", status: "Inactive", tier: "Bronze", pipelineValue: 150_000.12, totalRevenue: 159_200.3, pi: 37, liveActivity: "—", liveActivityTrend: "down", context: "—", team: "Team C" },
];

export type CampaignHealth = "Good" | "Satisfactory" | "Alert" | "Discontinued";

export type CampaignActivityRow = {
  name: string;
  health: CampaignHealth;
  healthTrend: TrendDirection;
  context: string;
  active: boolean;
};

export const campaignActivity: CampaignActivityRow[] = [
  { name: "Grand Royale Launch", health: "Good", healthTrend: "up", context: "73.33% of leads are in qualified status", active: true },
  { name: "Serene Vista Kickoff", health: "Good", healthTrend: "up", context: "62% of leads are in qualified status", active: true },
  { name: "Twilight Sands Promo", health: "Good", healthTrend: "up", context: "60% of leads are in qualified status", active: true },
  { name: "Azure Bay Campaign", health: "Good", healthTrend: "up", context: "53% of leads are in qualified status", active: true },
  { name: "Ocean Breeze Reveal", health: "Satisfactory", healthTrend: "flat", context: "52% of leads are in qualified status", active: true },
  { name: "Metro Luxe Drive", health: "Satisfactory", healthTrend: "flat", context: "51% of leads are in qualified status", active: true },
  { name: "Online Booking Sprint", health: "Alert", healthTrend: "down", context: "60% of leads are not qualified", active: true },
  { name: "Design Suites Launch", health: "Alert", healthTrend: "down", context: "62% of leads are not responding", active: true },
  { name: "VIP Suites Offer", health: "Alert", healthTrend: "down", context: "53% of leads have incorrect contact details", active: true },
  { name: "Peak Retreat Promo", health: "Discontinued", healthTrend: "flat", context: "—", active: false },
];

export type LeadActivityRow = {
  name: string;
  health: TrendDirection;
  interestCategory: "High" | "Good" | "Low";
  interestTrend: "Improving" | "Maintaining" | "Decreasing";
  // BPM: undefined metric in the PRD — placeholder only, flagged for
  // business clarification before this is treated as a real score.
  bpm: number;
  activity: string;
  leadOwner: string;
};

export const leadActivity: LeadActivityRow[] = [
  { name: "Evelyn Hayes", health: "up", interestCategory: "High", interestTrend: "Improving", bpm: 100, activity: "2 mins ago", leadOwner: "Agent 1" },
  { name: "Theodore Vance", health: "up", interestCategory: "High", interestTrend: "Improving", bpm: 100, activity: "6 mins ago", leadOwner: "Agent 2" },
  { name: "Luna Wright", health: "flat", interestCategory: "High", interestTrend: "Maintaining", bpm: 88, activity: "11 mins ago", leadOwner: "Agent 3" },
  { name: "Jasper Reed", health: "down", interestCategory: "High", interestTrend: "Decreasing", bpm: 78, activity: "15 mins ago", leadOwner: "Agent 4" },
  { name: "Scarlett Hayes", health: "up", interestCategory: "Good", interestTrend: "Improving", bpm: 68, activity: "24 mins ago", leadOwner: "Agent 5" },
  { name: "Atticus Vance", health: "flat", interestCategory: "Good", interestTrend: "Maintaining", bpm: 64, activity: "37 mins ago", leadOwner: "Agent 6" },
  { name: "Hazel Wright", health: "flat", interestCategory: "Good", interestTrend: "Maintaining", bpm: 60, activity: "6 hours ago", leadOwner: "Agent 7" },
  { name: "Milo Reed", health: "down", interestCategory: "Good", interestTrend: "Decreasing", bpm: 58, activity: "15 hours ago", leadOwner: "Agent 9" },
  { name: "Violet Hayes", health: "down", interestCategory: "Low", interestTrend: "Decreasing", bpm: 42, activity: "5 days ago", leadOwner: "Agent 10" },
];

export function formatMoney(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
