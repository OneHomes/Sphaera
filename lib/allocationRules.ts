// PLACEHOLDER THRESHOLDS — not business-approved. PRD R08 ("Unfair Lead
// Allocation") requires capacity/fairness controls in routing rules, but
// the exact caps must be signed off by the One Homes business owner
// before UAT — same governance pattern as AEX tier thresholds
// (lib/aexTransform.ts).

export const MAX_ACTIVE_LEAD_ASSIGNMENTS = 15;
export const MAX_ACTIVE_OPPORTUNITY_ASSIGNMENTS = 15;

// Opportunity stages that count as "closed" and therefore don't count
// against an agent's active-assignment capacity. Lead has no closed-stage
// concept in the current schema (leads convert into Opportunities before
// reaching a closed state), so lead capacity counts all assigned leads.
export const CLOSED_OPPORTUNITY_STAGES = ["Closed Won", "Closed Lost"];