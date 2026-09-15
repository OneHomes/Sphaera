// Fair-allocation caps (PRD R08) moved to lib/aexConfig.ts / AexConfig —
// real, admin-configurable values (PRD AV10) instead of hardcoded
// constants. This file now only holds the stage-set that isn't a
// configurable number.

// Opportunity stages that count as "closed" and therefore don't count
// against an agent's active-assignment capacity. Lead has no closed-stage
// concept in the current schema (leads convert into Opportunities before
// reaching a closed state), so lead capacity counts all assigned leads.
export const CLOSED_OPPORTUNITY_STAGES = ["Closed Won", "Closed Lost"];
