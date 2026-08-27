// Shared types/utilities used across Business Activity, AEX, and People.
// The mock row arrays that used to live here (agentActivity,
// campaignActivity, leadActivity) have been removed — Business Activity
// now computes these from real Users/Leads/Opportunities in
// app/(app)/business-activity/page.tsx. See that file's comments for
// exactly which fields are real vs. still placeholder (Live Activity,
// auto-generated Context, BPM, and Team remain placeholder — they need
// telephony presence, LLM summarization, a defined metric, and a team
// hierarchy model respectively, none of which exist yet).

export type AgentStatus = "Active" | "Inactive";
export type Tier = "Gold" | "Silver" | "Bronze";
export type TrendDirection = "up" | "down" | "flat";

export type CampaignHealth = "Good" | "Satisfactory" | "Alert" | "Discontinued";

export function formatMoney(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}