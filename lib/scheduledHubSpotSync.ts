import { prisma } from "./prisma";
import { fetchExistingEngagementIds, syncHubSpotActivityForLeads } from "./hubspotActivitySync";
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
// Behavioral events cost 3 HubSpot calls per lead (no batch API — see
// lib/hubspotBehavioralSync.ts) and has to finish inside one HTTP request,
// so this is capped to the newest leads. Fine for the pilot's lead count;
// past the cap it needs a rotating cursor instead.
const MAX_LEADS = 50;

export type ScheduledSyncResult = {
  leads: number;
  activityImported: number;
  activityUpdated: number;
  activityRemoved: number;
  behavioralImported: number;
  failedTypes: string[];
};

export async function runScheduledHubSpotSync(): Promise<ScheduledSyncResult> {
  const leads = await prisma.lead.findMany({
    where: { hubspotId: { not: null } },
    select: { id: true, name: true, email: true, hubspotId: true },
    orderBy: { createdAt: "desc" },
    take: MAX_LEADS,
  });
  if (leads.length === 0) {
    return { leads: 0, activityImported: 0, activityUpdated: 0, activityRemoved: 0, behavioralImported: 0, failedTypes: [] };
  }

  const existing = await fetchExistingEngagementIds();
  const activity = await syncHubSpotActivityForLeads(
    leads.map((l) => ({ id: l.id, hubspotId: l.hubspotId! })),
    existing,
    { refreshExisting: true, removeDeleted: true }
  );
  const behavioral = await syncBehavioralEventsForLeads(
    leads.map((l) => ({ id: l.id, name: l.name, hubspotId: l.hubspotId!, email: l.email })),
    existing
  );

  const result: ScheduledSyncResult = {
    leads: leads.length,
    activityImported: activity.totalImported,
    activityUpdated: activity.totalUpdated,
    activityRemoved: activity.totalRemoved,
    behavioralImported: behavioral.imported,
    failedTypes: Object.entries(activity.perType)
      .filter(([, v]) => v.failed)
      .map(([k]) => k),
  };

  // Only audit runs that changed something or hit an error — a row every
  // 15 minutes saying "nothing new" would bury the useful entries.
  const changed = result.activityImported + result.activityUpdated + result.activityRemoved + result.behavioralImported;
  if (changed > 0 || result.failedTypes.length > 0) {
    await logAudit({
      actorId: "system",
      actorEmail: "scheduled-sync",
      action: "hubspot_scheduled_sync",
      details: `${result.leads} leads: activity ${result.activityImported} new, ${result.activityUpdated} edited, ${result.activityRemoved} removed (deleted in HubSpot); ${result.behavioralImported} marketing/behavioral events${
        result.failedTypes.length ? `; failed: ${result.failedTypes.join(", ")}` : ""
      }`,
    });
  }
  return result;
}
