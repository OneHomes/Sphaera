import type { Lead } from "@/lib/leadData";
import { leadStageRank } from "@/lib/leadData";

// Shared types for the lead profile — real timeline/notes now come from
// the DB (see app/(app)/leads/[id]/page.tsx), these type defs are still
// used by LeadProfile.tsx and its children.

export type TimelineEventType =
  | "call"
  | "email"
  | "meeting"
  | "note"
  | "stage_change"
  | "task"
  | "handover";

export type TimelineEvent = {
  id: string;
  type: TimelineEventType;
  timestamp: string;
  summary: string;
};

export type Qualification = {
  budgetRange: string;
  bedroomPreference: string;
  moveInTimeline: string;
  financing: string;
};

// Still a heuristic estimate, not backed by a real Lead field — see the
// footnote in LeadSidePanel.tsx where this is rendered.
export function getQualification(lead: Lead): Qualification {
  return {
    budgetRange: lead.score > 70 ? "$150K – $250K" : "$70K – $150K",
    bedroomPreference: lead.projectInterest.includes("Studio")
      ? "Studio"
      : "1–2 Bedroom",
    moveInTimeline: (leadStageRank[lead.stage] ?? 0) === 0 ? "Not yet confirmed" : "3–6 months",
    financing: lead.score > 60 ? "Pre-approved" : "Not yet discussed",
  };
}

export type Note = {
  id: string;
  author: string;
  timestamp: string;
  text: string;
};
