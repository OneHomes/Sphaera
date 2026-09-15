// Real Salesforce picklist values (Lead.Status / Lead.LeadSource), pulled
// live from the org's Lead object describe — not an invented placeholder
// list. Salesforce admins can add/edit picklist values over time, so
// treat this as a snapshot to keep roughly in sync, not a hard contract;
// anywhere these are used as a lookup key falls back gracefully for a
// value not in this list (see leadStageRank/leadScoring/LeadBadges).

export type LeadPriority = "High" | "Medium" | "Low";
// Real Salesforce Status values are free-form from the org's own
// picklist, not a fixed small set — kept as `string` rather than a
// union so a new/renamed Salesforce status never breaks a build.
export type LeadStage = string;
export type EngagementLevel = "High" | "Medium" | "Low";
export type AssignmentStatus = "Assigned" | "Locked" | "Unassigned";

// Real Lead.Status values (Salesforce org describe, 23 values). Ordered
// roughly earliest -> most advanced for display purposes; the real
// ranking used for scoring/badges/AEX lives in leadStageRank below.
export const leadStages: LeadStage[] = [
  "New Lead / Not Contacted Yet",
  "Called & No Answer",
  "Incorrect Contact Info",
  "Interested",
  "Interested OSR",
  "Booked",
  "Presentation",
  "Reconfirmed",
  "Attended",
  "No Show",
  "Not Attended",
  "Qualified",
  "EOI Submitted",
  "EOI / Wishlist Signed",
  "Validated",
  "Proof of payment / DocuSign",
  "Negotiation",
  "SPA Completed",
  "1st Instalment Received",
  "Convert lead",
  "Not Interested",
  "Cancelled - Closed",
  "Remove from DB",
];

// Real Lead.LeadSource values (Salesforce org describe, 52 values).
export const leadSources: string[] = [
  "Agent Sales", "Client Referral", "CPIC Survey", "CPIC Website",
  "CPIC Website Call Back Lead", "CPIC Website Response IQ", "Email & SMS",
  "Emails", "Employee Referral", "EventBrite", "Event Walk-In", "Facebook",
  "Facebook Landing Page", "Facebook Lead Form", "Flyer Outdoor - billboards",
  "Flyer Outdoor - busses & trams", "Flyer Outdoor - other",
  "Google Display Network", "Google Search", "Inspection Trip",
  "IPC Website", "Linkedin", "Live Chart", "Mobile App Lead",
  "Mobile App Referral", "NHS", "Other", "Others", "Partner Referral",
  "Phone Inquiry", "Purchased List", "Radio", "Referral Partner", "SMS",
  "Typeform", "UK TV Ads", "US TV Ads", "Web", "Website - Islamabad",
  "OSR Pre Reservation", "Youtube", "Instagram Message", "Instagram Comment",
  "Facebook Message", "Facebook Comment", "Whatsapp", "TikTok Comment",
  "LinkedIn Message", "YouTube Comment", "Social", "Client Site Visit",
  "Existing Client",
];

export const leadPriorities: LeadPriority[] = ["High", "Medium", "Low"];

export type Lead = {
  id: string;
  name: string;
  contact: string;
  source: string;
  market: string;
  projectInterest: string;
  stage: LeadStage;
  score: number;
  engagement: EngagementLevel;
  priority: LeadPriority;
  lastInteraction: string;
  nextAction: string;
  nextActionDue: string;
  assignment: AssignmentStatus;
  lockedUntilLabel?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  prioritizationReason: string;
};

// PRD AE07 (Lead Scoring). Groups the 23 real statuses into a rank order
// reflecting real funnel progress — used for AEX "forward progress"
// point awards, the Productivity Index's "qualified or further" set,
// and badge coloring. -1 = negative/terminal (doesn't count as
// progress). PLACEHOLDER grouping — a business call, not a technical
// one; easy to adjust once real data is flowing.
export const leadStageRank: Record<string, number> = {
  "New Lead / Not Contacted Yet": 0,
  "Called & No Answer": 1,
  "Incorrect Contact Info": 1,
  "Interested": 2,
  "Interested OSR": 2,
  "Booked": 3,
  "Presentation": 3,
  "Reconfirmed": 3,
  "Attended": 4,
  "No Show": 4,
  "Not Attended": 4,
  "Qualified": 5,
  "EOI Submitted": 5,
  "EOI / Wishlist Signed": 5,
  "Validated": 6,
  "Proof of payment / DocuSign": 6,
  "Negotiation": 7,
  "SPA Completed": 8,
  "1st Instalment Received": 9,
  "Convert lead": 9,
  "Not Interested": -1,
  "Cancelled - Closed": -1,
  "Remove from DB": -1,
};

// PRD AE07 — "qualified or later" set, used by the Productivity Index's
// Engagement Conversion dimension and Business Activity's qualified-rate.
// Derived from leadStageRank rather than hand-listed twice.
export const QUALIFIED_STAGE_RANK_THRESHOLD = 5;
export function isQualifiedOrLater(stage: string): boolean {
  return (leadStageRank[stage] ?? 0) >= QUALIFIED_STAGE_RANK_THRESHOLD;
}

// Real negative/terminal statuses (rank -1 above) — a lead in one of
// these is done, one way or another, and shouldn't show up in "what
// should I work on" queries (Mission Centre, Calls hub). Previously
// those queries excluded "Closed Won"/"Closed Lost", which are
// Opportunity-only values that never actually appeared on Lead.stage —
// a silent no-op bug this real-status switch surfaced.
export const TERMINAL_LEAD_STAGES: string[] = Object.entries(leadStageRank)
  .filter(([, rank]) => rank < 0)
  .map(([stage]) => stage);

// Real statuses that represent "a meeting is on the books" — used by
// Next Best Action's stale-meeting check.
export const MEETING_BOOKED_STAGES = new Set([
  "Booked",
  "Presentation",
  "Reconfirmed",
]);

export function scoreBand(score: number): "Hot" | "Warm" | "Cool" {
  if (score >= 75) return "Hot";
  if (score >= 50) return "Warm";
  return "Cool";
}
