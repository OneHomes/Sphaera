import type { Opportunity as PrismaOpportunity, User } from "@prisma/client";
import type { Opportunity, OpportunityStage } from "./pipelineData";

// Same principle as lib/leadTransform.ts — the real close date is stored
// in the database; a friendly label ("This week", "This month", "Closed")
// is computed at read time so it never goes stale.

export function formatExpectedClose(date: Date | null): string {
  if (!date) return "—";
  const diffMs = date.getTime() - Date.now();
  if (diffMs < 0) return "Closed";
  const diffDays = diffMs / (24 * 3_600_000);
  if (diffDays <= 7) return "This week";
  if (diffDays <= 31) return "This month";
  return "Next quarter";
}

export function toUiOpportunity(
  row: PrismaOpportunity & { assignedUser?: User | null }
): Opportunity {
  return {
    id: row.id,
    leadName: row.leadName,
    contact: row.contact,
    value: row.value,
    probability: row.probability,
    expectedCloseDate: formatExpectedClose(row.expectedCloseAt),
    projectInterest: row.projectInterest,
    nextAction: row.nextAction,
    stage: row.stage as OpportunityStage,
    lossReason: row.lossReason ?? undefined,
    assignedUserId: row.assignedUserId ?? undefined,
    assignedUserName: row.assignedUser?.name ?? undefined,
  };
}