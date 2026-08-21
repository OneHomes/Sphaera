// Placeholder data only. Replace with a real query once the Gold-layer
// Lead entity is validated (see Sphaera_MVP_Build_Specification.md Section 6).
// Fields here map directly to PRD AE06 (Unified Lead Inbox) and AE07
// (Lead Scoring and Prioritisation) requirements.

export type LeadPriority = "High" | "Medium" | "Low";
export type LeadStage =
  | "New"
  | "Contacted"
  | "Qualified"
  | "Meeting Booked"
  | "Negotiation";
export type EngagementLevel = "High" | "Medium" | "Low";
export type AssignmentStatus = "Assigned" | "Locked" | "Unassigned";

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
  // The "reason" a rules/ML engine ranked this lead here — required by
  // PRD AE07 ("top contributing factors") and the general explainability
  // rule (JN14): every score must be able to say why.
  prioritizationReason: string;
};

export const leads: Lead[] = [
  {
    id: "L-1042",
    name: "Evelyn Hayes",
    contact: "+44 7911 123456",
    source: "Meta Ads",
    market: "UK",
    projectInterest: "One Serene Vista — 2 Bed",
    stage: "Qualified",
    score: 88,
    engagement: "High",
    priority: "High",
    lastInteraction: "2 mins ago",
    nextAction: "Call back",
    nextActionDue: "Today, 3:00 PM",
    assignment: "Assigned",
    prioritizationReason: "Responded within 5 min of last message; viewed 3 unit pages today",
  },
  {
    id: "L-1043",
    name: "Theodore Vance",
    contact: "+44 7911 654321",
    source: "HubSpot — Landing Page",
    market: "UK",
    projectInterest: "Azure Bay — 1 Bed Suite",
    stage: "Meeting Booked",
    score: 82,
    engagement: "High",
    priority: "High",
    lastInteraction: "6 mins ago",
    nextAction: "Prepare meeting brief",
    nextActionDue: "Today, 5:30 PM",
    assignment: "Assigned",
    prioritizationReason: "Meeting confirmed for today; high budget fit",
  },
  {
    id: "L-1044",
    name: "Luna Wright",
    contact: "luna.wright@gmail.com",
    source: "Salesforce",
    market: "UAE",
    projectInterest: "Downtown Getaway — Studio",
    stage: "Contacted",
    score: 71,
    engagement: "Medium",
    priority: "Medium",
    lastInteraction: "11 mins ago",
    nextAction: "Send follow-up email",
    nextActionDue: "Tomorrow, 10:00 AM",
    assignment: "Assigned",
    prioritizationReason: "Opened last 2 emails, no reply yet",
  },
  {
    id: "L-1045",
    name: "Jasper Reed",
    contact: "+971 50 123 4567",
    source: "Meta Ads",
    market: "UAE",
    projectInterest: "Ocean Breeze Residences",
    stage: "New",
    score: 45,
    engagement: "Low",
    priority: "Medium",
    lastInteraction: "15 mins ago",
    nextAction: "First contact call",
    nextActionDue: "Today, 6:00 PM",
    assignment: "Unassigned",
    prioritizationReason: "New lead — inside 60-minute speed-to-lead window",
  },
  {
    id: "L-1046",
    name: "Scarlett Hayes",
    contact: "scarlett.h@outlook.com",
    source: "HubSpot — Chat",
    market: "UK",
    projectInterest: "Metro Luxe Downtown",
    stage: "Qualified",
    score: 64,
    engagement: "Medium",
    priority: "Medium",
    lastInteraction: "24 mins ago",
    nextAction: "Share brochure",
    nextActionDue: "Today, 7:00 PM",
    assignment: "Assigned",
    prioritizationReason: "Asked about payment plans in last chat",
  },
  {
    id: "L-1047",
    name: "Atticus Vance",
    contact: "+44 7911 987654",
    source: "Salesforce",
    market: "UK",
    projectInterest: "Worldwide Stays",
    stage: "Contacted",
    score: 58,
    engagement: "Medium",
    priority: "Low",
    lastInteraction: "37 mins ago",
    nextAction: "Follow-up call",
    nextActionDue: "Tomorrow, 2:00 PM",
    assignment: "Assigned",
    prioritizationReason: "Moderate engagement, no urgency flagged",
  },
  {
    id: "L-1048",
    name: "Hazel Wright",
    contact: "+971 50 765 4321",
    source: "Meta Ads",
    market: "UAE",
    projectInterest: "Summit View Launch",
    stage: "New",
    score: 39,
    engagement: "Low",
    priority: "Low",
    lastInteraction: "6 hours ago",
    nextAction: "First contact call",
    nextActionDue: "Overdue",
    assignment: "Unassigned",
    prioritizationReason: "Missed 60-minute speed-to-lead window — needs immediate action",
  },
  {
    id: "L-1049",
    name: "Milo Reed",
    contact: "milo.reed@gmail.com",
    source: "HubSpot — Landing Page",
    market: "UK",
    projectInterest: "Peak Retreat Project",
    stage: "Contacted",
    score: 52,
    engagement: "Medium",
    priority: "Medium",
    lastInteraction: "15 hours ago",
    nextAction: "Re-engagement message",
    nextActionDue: "Today, 4:00 PM",
    assignment: "Assigned",
    prioritizationReason: "No response in 15 hours — risk of going cold",
  },
  {
    id: "L-1050",
    name: "Violet Hayes",
    contact: "+44 7911 456789",
    source: "Salesforce",
    market: "UK",
    projectInterest: "Bright Star Flats",
    stage: "New",
    score: 28,
    engagement: "Low",
    priority: "Low",
    lastInteraction: "5 days ago",
    nextAction: "Nurture / re-qualify",
    nextActionDue: "This week",
    assignment: "Unassigned",
    prioritizationReason: "Long inactivity — candidate for nurture track, not active outreach",
  },
];

export const leadSources = Array.from(new Set(leads.map((l) => l.source)));
export const leadStages: LeadStage[] = [
  "New",
  "Contacted",
  "Qualified",
  "Meeting Booked",
  "Negotiation",
];
export const leadPriorities: LeadPriority[] = ["High", "Medium", "Low"];

export function scoreBand(score: number): "Hot" | "Warm" | "Cool" {
  if (score >= 75) return "Hot";
  if (score >= 50) return "Warm";
  return "Cool";
}
