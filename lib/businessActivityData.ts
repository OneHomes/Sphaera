// Shared types/utilities used across Business Activity, AEX, and People.
// The mock row arrays that used to live here (agentActivity,
// campaignActivity, leadActivity) have been removed — Business Activity
// now computes these from real Users/Leads/Opportunities in
// app/(app)/business-activity/page.tsx. Live Activity, auto-generated
// Context, and BPM remain mock (Team is real) — they need telephony
// presence (Lexatail — confirmed provider, integration deferred to
// post-data-audit) and a defined BPM metric, neither of which exist yet.
// Real campaign-level data (Salesforce/Meta Ads/Google Ads) is likewise
// confirmed but deliberately not integrated until the data audit hands
// off connection details.

export type AgentStatus = "Active" | "Inactive";
export type Tier = "Gold" | "Silver" | "Bronze";
export type TrendDirection = "up" | "down" | "flat";

export type CampaignHealth = "Good" | "Satisfactory" | "Alert" | "Discontinued";

export function formatMoney(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Deterministic string hash used to pick stable mock values per entity
// (same lead/user always gets the same mock Live Activity, Context, BPM
// etc. within a session) without needing a real backing signal for
// telephony presence, LLM-summarized context, or the undefined BPM
// metric. Not cryptographic — just stable and cheap.
export function mockHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

export type LiveActivity = {
  label: string;
  context: string;
  trend: TrendDirection;
};

// Mock Live Activity + Context pairs (no telephony/presence integration
// yet — see AgentActivityTable's footnote). Cycled deterministically per
// agent via mockHash.
export const LIVE_ACTIVITY_POOL: LiveActivity[] = [
  { label: "In Call", context: "Discussing Manchester property investment", trend: "up" },
  { label: "Zoom Meeting", context: "Client walkthrough — Dubai Marina units", trend: "up" },
  { label: "Research", context: "Reviewing UK property market trends", trend: "flat" },
  { label: "Whatsapp", context: "Following up with Mr. John Jones", trend: "up" },
  { label: "Email", context: "Sending proposal for Dubai investment", trend: "flat" },
  { label: "Idle", context: "Between appointments", trend: "flat" },
  { label: "No Activity", context: "No activity logged in the last hour", trend: "down" },
];

// Mock per-source efficiency/status (no real campaign spend/CTR data
// yet — see CampaignActivityTable's footnote). Sources beyond the first
// few real ones roll into a "Discontinued" mock state so the grayed-out
// toggle treatment from the reference UI has something to show.
export function mockEfficiency(id: string): number {
  return 45 + (mockHash(id) % 50); // 45-94%
}

export function mockBpm(id: string): number {
  return mockHash(id) % 100;
}

const trendWordByDirection: Record<TrendDirection, string> = {
  up: "Improving",
  flat: "Maintaining",
  down: "Decreasing",
};

export function trendWord(direction: TrendDirection): string {
  return trendWordByDirection[direction];
}