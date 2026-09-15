// PRD JN05 (Next Best Action). Rule-based (PRD 17.1 maturity level 1 —
// "Rule based, governed business logic"), built on the same real signals
// as lib/leadScoring.ts: has this lead been contacted, is a meeting
// booked, and how long since anything real happened. No ML model, no
// invented probability — just an explainable next step.

import { leadStageRank, MEETING_BOOKED_STAGES } from "./leadData";

const CONTACT_TYPES = new Set(["call", "email", "meeting"]);
const STALE_DAYS = 14; // PLACEHOLDER — not business-approved, same governance pattern as the rest of this build
const STALE_MEETING_DAYS = 2;

export type NextBestActionType = "call" | "email" | "meeting" | "nurture" | "none";

export type NextBestAction = {
  action: NextBestActionType;
  label: string;
  reason: string;
  // PRD 4.5 (Explainable Intelligence) — every recommendation must show a
  // confidence level and source period alongside its reason. This is a
  // rule-based recommendation (no ML model), so "confidence" reflects how
  // much real activity history it's grounded in, not a statistical score.
  confidence: "High" | "Medium";
  sourcePeriod: string;
};

type TimelineEventInput = { type: string; occurredAt: Date };
type LeadInput = { stage: string; lastInteractionAt: Date | null; createdAt: Date };

export function getNextBestAction(
  lead: LeadInput,
  timelineEvents: TimelineEventInput[]
): NextBestAction {
  // Confidence reflects how much real activity this is grounded in — a
  // lead with a real history behind it is a firmer recommendation than
  // one based on just its creation date.
  const confidence: "High" | "Medium" = timelineEvents.length >= 2 ? "High" : "Medium";
  const sourcePeriod =
    timelineEvents.length > 0
      ? `Based on ${timelineEvents.length} logged event(s) since ${lead.createdAt.toLocaleDateString()}`
      : `Based on lead creation date only (${lead.createdAt.toLocaleDateString()}) — no activity logged yet`;

  if ((leadStageRank[lead.stage] ?? 0) < 0) {
    return {
      action: "none",
      label: "No action needed",
      reason: `This lead is marked "${lead.stage}".`,
      confidence: "High",
      sourcePeriod: "Based on current lead stage",
    };
  }

  const hasContact = timelineEvents.some((e) => CONTACT_TYPES.has(e.type));
  const hasMeeting = timelineEvents.some((e) => e.type === "meeting");
  const referenceDate = lead.lastInteractionAt ?? lead.createdAt;
  const daysSinceActivity = (Date.now() - referenceDate.getTime()) / 86_400_000;

  if (!hasContact) {
    const hoursSinceCreated = (Date.now() - lead.createdAt.getTime()) / 3_600_000;
    return {
      action: "call",
      label: "Call now",
      reason:
        hoursSinceCreated <= 1
          ? "No contact logged yet — still inside the 60-minute speed-to-lead window."
          : `No contact logged yet — ${Math.round(hoursSinceCreated)}h since this lead was created.`,
      confidence,
      sourcePeriod,
    };
  }

  if (daysSinceActivity >= STALE_DAYS) {
    return {
      action: "nurture",
      label: "Send a re-engagement message",
      reason: `${Math.round(daysSinceActivity)} days since the last logged activity — this lead is going cold.`,
      confidence,
      sourcePeriod,
    };
  }

  if (!hasMeeting && (leadStageRank[lead.stage] ?? 0) <= 2) {
    return {
      action: "meeting",
      label: "Propose a meeting",
      reason: "Contact has been made but no meeting is booked yet.",
      confidence,
      sourcePeriod,
    };
  }

  if (MEETING_BOOKED_STAGES.has(lead.stage) && daysSinceActivity >= STALE_MEETING_DAYS) {
    return {
      action: "meeting",
      label: "Confirm the meeting",
      reason: `No activity logged in ${Math.round(daysSinceActivity)} days since the meeting was booked.`,
      confidence,
      sourcePeriod,
    };
  }

  if (lead.stage === "Negotiation") {
    return {
      action: "email",
      label: "Follow up on negotiation",
      reason: "This lead is in Negotiation — a timely follow-up keeps momentum.",
      confidence,
      sourcePeriod,
    };
  }

  return {
    action: "email",
    label: "Send a follow-up",
    reason: `It's been ${Math.round(daysSinceActivity)} day(s) since the last touch — keep the conversation moving.`,
    confidence,
    sourcePeriod,
  };
}
