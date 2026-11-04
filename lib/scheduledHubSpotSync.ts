import { prisma } from "./prisma";
import { syncHubSpotActivityForLeads } from "./hubspotActivitySync";
import { syncBehavioralEventsForLeads } from "./hubspotBehavioralSync";
import { logAudit } from "./auditLog";

// Periodic catch-up, run every 15 minutes by .github/workflows/scheduled-sync.yml
// via app/api/cron/hubspot-sync/route.ts. Two gaps the webhooks can't close:
//  - Marketing email sends/opens/clicks (and page views, form submissions):
//    HubSpot has no webhook for these at all, so they only arrive by polling.
//  - Any call/email/meeting/note/task webhook HubSpot failed to deliver,
//    plus edits to and deletions of already-imported ones.
// Both underlying syncs are idempotent, so a run that finds nothing new
// writes nothing.
//
// Azure Static Web Apps cuts an API request off at ~45 seconds, and all of
// this together takes longer than that from Azure. So a run is split into
// steps the workflow calls one after another: "activity" (batched, a few
// seconds) and then "behavioral" in slices of BEHAVIORAL_SLICE leads —
// behavioral events cost 3 HubSpot calls per lead with no batch API (see
// lib/hubspotBehavioralSync.ts).
const MAX_LEADS = 50;
export const BEHAVIORAL_SLICE = 5;

function syncedLeads() {
  return prisma.lead.findMany({
    where: { hubspotId: { not: null } },
    select: { id: true, name: true, email: true, hubspotId: true },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: MAX_LEADS,
  });
}

async function existingIdsFor(leadIds: string[]): Promise<Set<string>> {
  const rows = await prisma.leadTimelineEvent.findMany({
    where: { leadId: { in: leadIds }, hubspotEngagementId: { not: null } },
    select: { hubspotEngagementId: true },
  });
  return new Set(rows.map((r) => r.hubspotEngagementId!));
}

// Only audit runs that changed something or hit an error — a row every
// 15 minutes saying "nothing new" would bury the useful entries.
async function auditIfChanged(changed: number, details: string, failed: string[] = []) {
  if (changed === 0 && failed.length === 0) return;
  await logAudit({
    actorId: "system",
    actorEmail: "scheduled-sync",
    action: "hubspot_scheduled_sync",
    details: `${details}${failed.length ? `; failed: ${failed.join(", ")}` : ""}`,
  });
}

export type ActivityStepResult = { leads: number; imported: number; updated: number; removed: number; failedTypes: string[] };

export async function runScheduledActivitySync(): Promise<ActivityStepResult> {
  const leads = await syncedLeads();
  if (leads.length === 0) return { leads: 0, imported: 0, updated: 0, removed: 0, failedTypes: [] };
  const activity = await syncHubSpotActivityForLeads(
    leads.map((l) => ({ id: l.id, hubspotId: l.hubspotId! })),
    await existingIdsFor(leads.map((l) => l.id)),
    { refreshExisting: true, removeDeleted: true }
  );
  const result: ActivityStepResult = {
    leads: leads.length,
    imported: activity.totalImported,
    updated: activity.totalUpdated,
    removed: activity.totalRemoved,
    failedTypes: Object.entries(activity.perType)
      .filter(([, v]) => v.failed)
      .map(([k]) => k),
  };
  await auditIfChanged(
    result.imported + result.updated + result.removed,
    `${result.leads} leads: activity ${result.imported} new, ${result.updated} edited, ${result.removed} removed (deleted in HubSpot)`,
    result.failedTypes
  );
  return result;
}

export type BehavioralStepResult = { leads: number; imported: number; nextOffset: number | null };

export async function runScheduledBehavioralSync(offset: number): Promise<BehavioralStepResult> {
  const all = await syncedLeads();
  const slice = all.slice(offset, offset + BEHAVIORAL_SLICE);
  if (slice.length === 0) return { leads: 0, imported: 0, nextOffset: null };
  const { imported } = await syncBehavioralEventsForLeads(
    slice.map((l) => ({ id: l.id, name: l.name, hubspotId: l.hubspotId!, email: l.email })),
    await existingIdsFor(slice.map((l) => l.id))
  );
  await auditIfChanged(imported, `leads ${offset + 1}-${offset + slice.length}: ${imported} marketing email/page view/form events`);
  const next = offset + BEHAVIORAL_SLICE;
  return { leads: slice.length, imported, nextOffset: next < all.length ? next : null };
}
