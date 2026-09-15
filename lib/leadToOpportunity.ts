import { prisma } from "./prisma";
import { leadStageRank } from "./leadData";

// This Salesforce org tracks deals directly on the Lead (real Estimated
// Value / Closing Date fields, no populated Opportunity object — see
// the sync's discovery notes in lib/salesforceSync.ts). So rather than
// syncing a separate Salesforce object, a real Sphaera Opportunity is
// created automatically the moment a lead's real status crosses into
// deal territory — whether that happens right at import, or later when
// an agent moves the lead forward inside Sphaera themselves.

// PLACEHOLDER threshold/mapping — a business call, not a technical one,
// same governance note as the rest of this build's scoring/ranking
// tables (lib/leadData.ts leadStageRank).
const OPPORTUNITY_STAGE_RANK_THRESHOLD = 6; // Validated / Proof of payment and beyond

const WON_STAGES = new Set(["SPA Completed", "1st Instalment Received", "Convert lead"]);

function probabilityForStage(stage: string): number {
  if (WON_STAGES.has(stage)) return 100;
  if (stage === "Negotiation") return 50;
  if (stage === "Proof of payment / DocuSign") return 40;
  if (stage === "Validated") return 30;
  return 50;
}

function opportunityStageFor(stage: string): string {
  return WON_STAGES.has(stage) ? "Closed Won" : "Negotiation";
}

type LeadForOpportunity = {
  id: string;
  name: string;
  contact: string;
  stage: string;
  projectInterest: string;
  estimatedValue: number | null;
  estimatedCloseAt: Date | null;
  assignedUserId: string | null;
};

/**
 * Creates a real Opportunity from a lead if (a) its real status has
 * reached deal territory and (b) it doesn't already have one linked.
 * Safe to call on every stage change / sync pass — a no-op once an
 * Opportunity already exists for the lead.
 */
export async function maybeCreateOpportunityFromLead(leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { opportunities: { select: { id: true }, take: 1 } },
  });
  if (!lead) return;
  if (lead.opportunities.length > 0) return; // already has one — never create a second

  const rank = leadStageRank[lead.stage] ?? 0;
  if (rank < OPPORTUNITY_STAGE_RANK_THRESHOLD) return;

  await prisma.opportunity.create({
    data: {
      leadName: lead.name,
      contact: lead.contact,
      value: lead.estimatedValue ?? 0,
      probability: probabilityForStage(lead.stage),
      expectedCloseAt: lead.estimatedCloseAt,
      projectInterest: lead.projectInterest,
      nextAction: "Follow up",
      stage: opportunityStageFor(lead.stage),
      leadId: lead.id,
      assignedUserId: lead.assignedUserId,
    },
  });
}
