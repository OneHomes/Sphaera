import type { Lead } from "@/lib/leadData";

// Placeholder/illustrative data only — does not depend on which specific
// lead is open. Once real activity events exist (per the Sphaera domain
// model's Activity/Call/Email/Meeting entities), replace these functions
// with real queries filtered by lead ID.

export type TimelineEventType =
  | "call"
  | "email"
  | "meeting"
  | "note"
  | "stage_change"
  | "task";

export type TimelineEvent = {
  id: string;
  type: TimelineEventType;
  timestamp: string;
  summary: string;
};

export function getTimelineForLead(lead: Lead): TimelineEvent[] {
  return [
    {
      id: "t1",
      type: "stage_change",
      timestamp: "5 days ago",
      summary: `Lead created from ${lead.source}`,
    },
    {
      id: "t2",
      type: "call",
      timestamp: "4 days ago",
      summary: "First contact call — connected, 4 min duration",
    },
    {
      id: "t3",
      type: "email",
      timestamp: "3 days ago",
      summary: `Sent brochure for ${lead.projectInterest}`,
    },
    {
      id: "t4",
      type: "stage_change",
      timestamp: "2 days ago",
      summary: `Stage moved to ${lead.stage}`,
    },
    {
      id: "t5",
      type: "meeting",
      timestamp: "Yesterday",
      summary: "Site viewing scheduled and confirmed",
    },
    {
      id: "t6",
      type: "note",
      timestamp: lead.lastInteraction,
      summary: lead.prioritizationReason,
    },
  ];
}

export type Qualification = {
  budgetRange: string;
  bedroomPreference: string;
  moveInTimeline: string;
  financing: string;
};

export function getQualification(lead: Lead): Qualification {
  return {
    budgetRange: lead.score > 70 ? "$150K – $250K" : "$70K – $150K",
    bedroomPreference: lead.projectInterest.includes("Studio")
      ? "Studio"
      : "1–2 Bedroom",
    moveInTimeline: lead.stage === "New" ? "Not yet confirmed" : "3–6 months",
    financing: lead.score > 60 ? "Pre-approved" : "Not yet discussed",
  };
}

export type OpportunityDetail = {
  value: number;
  probability: number;
  expectedCloseDate: string;
};

export function getOpportunityDetail(lead: Lead): OpportunityDetail {
  const baseValue = 90_000 + lead.score * 1_500;
  return {
    value: Math.round(baseValue / 100) * 100,
    probability: Math.min(95, Math.round(lead.score * 0.9)),
    expectedCloseDate:
      lead.stage === "Negotiation" ? "This month" : "Next quarter",
  };
}

export type Note = {
  id: string;
  author: string;
  timestamp: string;
  text: string;
};

export function getInitialNotes(lead: Lead): Note[] {
  return [
    {
      id: "n1",
      author: "You",
      timestamp: "2 days ago",
      text: `Client interested in ${lead.projectInterest}, asked about payment plan flexibility.`,
    },
  ];
}
