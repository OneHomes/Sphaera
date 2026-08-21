// Placeholder data only. Replace with a real query against the Opportunity
// entity once the Gold-layer data is validated. Stage set here consolidates
// PRD AE15's full 10-stage list (new, contacted, qualified, meeting booked,
// meeting conducted, opportunity, negotiation, expression of
// interest/reservation pending, closed won, closed lost) into 8 columns for
// MVP board readability — "meeting conducted" folds into "Meeting Booked"
// and "expression of interest/reservation pending" folds into
// "Negotiation". One Homes should confirm final stage naming before UAT
// (this is explicitly flagged as an open decision in PRD Section 29).

export type OpportunityStage =
  | "New"
  | "Contacted"
  | "Qualified"
  | "Meeting Booked"
  | "Opportunity"
  | "Negotiation"
  | "Closed Won"
  | "Closed Lost";

export const pipelineStages: OpportunityStage[] = [
  "New",
  "Contacted",
  "Qualified",
  "Meeting Booked",
  "Opportunity",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
];

export type Opportunity = {
  id: string;
  leadName: string;
  contact: string;
  value: number;
  probability: number;
  expectedCloseDate: string;
  projectInterest: string;
  nextAction: string;
  stage: OpportunityStage;
  lossReason?: string;
};

export const initialOpportunities: Opportunity[] = [
  { id: "OPP-2001", leadName: "Evelyn Hayes", contact: "+44 7911 123456", value: 210_000, probability: 82, expectedCloseDate: "This month", projectInterest: "One Serene Vista — 2 Bed", nextAction: "Call back today", stage: "Qualified" },
  { id: "OPP-2002", leadName: "Theodore Vance", contact: "+44 7911 654321", value: 175_000, probability: 75, expectedCloseDate: "This month", projectInterest: "Azure Bay — 1 Bed Suite", nextAction: "Meeting prep", stage: "Meeting Booked" },
  { id: "OPP-2003", leadName: "Luna Wright", contact: "luna.wright@gmail.com", value: 130_000, probability: 55, expectedCloseDate: "Next quarter", projectInterest: "Downtown Getaway — Studio", nextAction: "Follow-up email", stage: "Contacted" },
  { id: "OPP-2004", leadName: "Scarlett Hayes", contact: "scarlett.h@outlook.com", value: 156_000, probability: 60, expectedCloseDate: "Next quarter", projectInterest: "Metro Luxe Downtown", nextAction: "Share brochure", stage: "Qualified" },
  { id: "OPP-2005", leadName: "Marcus Webb", contact: "marcus.webb@gmail.com", value: 240_000, probability: 68, expectedCloseDate: "This month", projectInterest: "One Serene Vista — 3 Bed", nextAction: "Draft proposal", stage: "Opportunity" },
  { id: "OPP-2006", leadName: "Priya Anand", contact: "+971 50 222 3344", value: 310_000, probability: 88, expectedCloseDate: "This month", projectInterest: "Ocean Breeze Residences", nextAction: "Finalise payment plan", stage: "Negotiation" },
  { id: "OPP-2007", leadName: "Daniel Osei", contact: "daniel.osei@gmail.com", value: 98_000, probability: 40, expectedCloseDate: "Next quarter", projectInterest: "Worldwide Stays", nextAction: "First contact call", stage: "New" },
  { id: "OPP-2008", leadName: "Aisha Karim", contact: "+971 50 555 6677", value: 185_000, probability: 92, expectedCloseDate: "This week", projectInterest: "Downtown Getaway — 2 Bed", nextAction: "Send contract", stage: "Negotiation" },
  { id: "OPP-2009", leadName: "Ben Foster", contact: "ben.foster@outlook.com", value: 145_000, probability: 100, expectedCloseDate: "Closed", projectInterest: "Metro Luxe Downtown", nextAction: "Handover to collections", stage: "Closed Won" },
  { id: "OPP-2010", leadName: "Grace Lin", contact: "grace.lin@gmail.com", value: 120_000, probability: 0, expectedCloseDate: "Closed", projectInterest: "Peak Retreat Project", nextAction: "Archive", stage: "Closed Lost", lossReason: "Chose competitor" },
];

export const lossReasons = [
  "Budget mismatch",
  "Chose a competitor",
  "Financing fell through",
  "No longer interested",
  "Unresponsive / went cold",
  "Other",
];

export function formatMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  return `$${(value / 1_000).toFixed(0)}K`;
}
