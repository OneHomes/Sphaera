import { prisma } from "./prisma";
import { batchReadAssociations, batchReadObjects, type HubSpotObject } from "./hubspot";

// Pulls full HubSpot activity history (calls, emails, meetings, notes,
// tasks) into the same LeadTimelineEvent table Sphaera's own in-app
// activity already writes to (notes, logged calls, stage changes —
// see app/api/leads/[id]/notes/route.ts, interactions/route.ts, etc.).
// Both sources land in one chronological timeline on the lead profile —
// nothing extra needed to "merge" them, they already share the table.
//
// Idempotent: hubspotEngagementId is checked before insert, so re-running
// this only pulls in genuinely new engagements, never duplicates.

export type EngagementConfig = {
  hubspotType: string; // HubSpot object type, e.g. "emails"
  timelineType: string; // LeadTimelineEvent.type value, e.g. "email"
  properties: string[];
  summarize: (p: Record<string, string | null>) => string;
};

const truthy = (v: string | null | undefined) => typeof v === "string" && v.trim().length > 0;
const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

const ENGAGEMENT_TYPES: EngagementConfig[] = [
  {
    hubspotType: "calls",
    timelineType: "call",
    properties: ["hs_call_title", "hs_call_body", "hs_call_disposition", "hs_call_status", "hs_timestamp"],
    summarize: (p) =>
      `Call: ${p.hs_call_title || "Untitled call"}${p.hs_call_disposition ? ` — ${p.hs_call_disposition}` : p.hs_call_status ? ` — ${p.hs_call_status}` : ""}${p.hs_call_body ? `\n${trunc(p.hs_call_body, 2000)}` : ""}`,
  },
  {
    hubspotType: "emails",
    timelineType: "email",
    properties: ["hs_email_subject", "hs_email_direction", "hs_email_text", "hs_timestamp"],
    summarize: (p) =>
      `Email${p.hs_email_direction ? ` (${p.hs_email_direction})` : ""}: ${p.hs_email_subject || "(no subject)"}${p.hs_email_text ? `\n${trunc(p.hs_email_text, 2000)}` : ""}`,
  },
  {
    hubspotType: "meetings",
    timelineType: "meeting",
    properties: ["hs_meeting_title", "hs_meeting_outcome", "hs_meeting_body", "hs_timestamp"],
    summarize: (p) =>
      `Meeting: ${p.hs_meeting_title || "Untitled meeting"}${p.hs_meeting_outcome ? ` — ${p.hs_meeting_outcome}` : ""}${p.hs_meeting_body ? `\n${trunc(p.hs_meeting_body, 2000)}` : ""}`,
  },
  {
    hubspotType: "notes",
    timelineType: "note",
    properties: ["hs_note_body", "hs_timestamp"],
    summarize: (p) => `Note: ${trunc(p.hs_note_body || "(empty note)", 2000)}`,
  },
  {
    hubspotType: "tasks",
    timelineType: "task",
    properties: ["hs_task_subject", "hs_task_status", "hs_timestamp"],
    summarize: (p) => `Task: ${p.hs_task_subject || "Untitled task"}${p.hs_task_status ? ` — ${p.hs_task_status}` : ""}`,
  },
];

// Keyed by the singular object name HubSpot uses in webhook
// subscriptionType strings ("call.creation", "email.propertyChange", …)
// — see lib/hubspotEngagementWebhook.ts, the real-time counterpart to
// this file's bulk sweep.
export const ENGAGEMENT_TYPE_BY_WEBHOOK_NAME: Record<string, EngagementConfig> = Object.fromEntries(
  ENGAGEMENT_TYPES.map((c) => [c.hubspotType.slice(0, -1), c])
);

export type ActivitySyncResult = {
  perType: Record<string, { found: number; imported: number; failed: boolean }>;
  totalImported: number;
};

async function fetchExistingEngagementIds(): Promise<Set<string>> {
  const rows = await prisma.leadTimelineEvent.findMany({
    where: { hubspotEngagementId: { not: null } },
    select: { hubspotEngagementId: true },
  });
  return new Set(rows.map((r) => r.hubspotEngagementId!));
}

// Shared by both syncHubSpotActivity (one bounded admin-triggered batch)
// and syncHubSpotActivityForAllLeads (the full sweep below) — takes the
// existing-engagement-id set by reference and adds to it as rows are
// inserted, so a multi-batch caller never re-queries the whole
// (ever-growing) LeadTimelineEvent table once per batch.
export async function syncHubSpotActivityForLeads(
  leads: { id: string; hubspotId: string }[],
  existingEngagementIds: Set<string>
): Promise<ActivitySyncResult> {
  const leadIdByHubspotId = new Map(leads.map((l) => [l.hubspotId, l.id]));
  const hubspotIds = leads.map((l) => l.hubspotId);

  const result: ActivitySyncResult = { perType: {}, totalImported: 0 };

  for (const config of ENGAGEMENT_TYPES) {
    try {
      const associations = await batchReadAssociations("contacts", config.hubspotType, hubspotIds);

      const allEngagementIds = [...new Set([...associations.values()].flat())];
      if (allEngagementIds.length === 0) {
        result.perType[config.hubspotType] = { found: 0, imported: 0, failed: false };
        continue;
      }

      const engagements = await batchReadObjects(config.hubspotType, allEngagementIds, config.properties);
      const engagementById = new Map<string, HubSpotObject>(engagements.map((e) => [e.id, e]));

      const rows: { leadId: string; type: string; summary: string; occurredAt: Date; hubspotEngagementId: string }[] = [];
      for (const [hubspotContactId, engagementIds] of associations) {
        const leadId = leadIdByHubspotId.get(hubspotContactId);
        if (!leadId) continue;
        for (const engagementId of engagementIds) {
          if (existingEngagementIds.has(engagementId)) continue;
          const engagement = engagementById.get(engagementId);
          if (!engagement) continue;
          const occurredAt = truthy(engagement.properties.hs_timestamp)
            ? new Date(engagement.properties.hs_timestamp!)
            : new Date();
          rows.push({
            leadId,
            type: config.timelineType,
            summary: config.summarize(engagement.properties),
            occurredAt,
            hubspotEngagementId: engagementId,
          });
        }
      }

      for (let i = 0; i < rows.length; i += 500) {
        await prisma.leadTimelineEvent.createMany({ data: rows.slice(i, i + 500) });
      }
      for (const r of rows) existingEngagementIds.add(r.hubspotEngagementId);

      result.perType[config.hubspotType] = {
        found: allEngagementIds.length,
        imported: rows.length,
        failed: false,
      };
      result.totalImported += rows.length;
    } catch (err) {
      // Best-effort per type — e.g. emails without the crm.objects.emails.read
      // scope yet shouldn't block calls/meetings/notes/tasks from importing.
      console.error(`HubSpot activity sync: ${config.hubspotType} failed:`, err);
      result.perType[config.hubspotType] = { found: 0, imported: 0, failed: true };
    }
  }

  return result;
}

/** One bounded batch, admin-triggered from HubSpotSyncCard.tsx. */
export async function syncHubSpotActivity(leadLimit = 2500): Promise<ActivitySyncResult> {
  const leads = await prisma.lead.findMany({
    where: { hubspotId: { not: null } },
    select: { id: true, hubspotId: true },
    take: leadLimit,
  });
  const existingEngagementIds = await fetchExistingEngagementIds();
  return syncHubSpotActivityForLeads(
    leads.map((l) => ({ id: l.id, hubspotId: l.hubspotId! })),
    existingEngagementIds
  );
}

export type ActivityBulkSyncProgress = {
  leadsProcessed: number;
  totalLeads: number;
  totalImported: number;
  batchesFailed: number;
};

// 2026-10-15 — syncHubSpotActivity's leadLimit=2500 cap meant only ~0.6%
// of the ~191,000 HubSpot-imported leads ever got their activity history
// pulled in. This sweeps ALL of them, in small lead batches (so each
// HubSpot call stays small and a failure only loses one batch, not the
// whole run), with a short pause between batches — same reasoning as
// lib/hubspotBulkImport.ts's self-throttling: a tight loop hammering
// Azure SQL + HubSpot back-to-back for the hours this will take is
// exactly what starved the DB connection pool and took the live site
// down earlier this session. Cursor-paginated (not skip-based) so it
// doesn't slow down as it works through ~383 batches.
export async function syncHubSpotActivityForAllLeads(
  onProgress?: (progress: ActivityBulkSyncProgress) => void,
  batchSize = 500,
  pauseMs = 500
): Promise<ActivityBulkSyncProgress> {
  const totalLeads = await prisma.lead.count({ where: { hubspotId: { not: null } } });
  const existingEngagementIds = await fetchExistingEngagementIds();

  const progress: ActivityBulkSyncProgress = {
    leadsProcessed: 0,
    totalLeads,
    totalImported: 0,
    batchesFailed: 0,
  };

  let cursorId: string | undefined;
  for (;;) {
    const batch = await prisma.lead.findMany({
      where: { hubspotId: { not: null } },
      select: { id: true, hubspotId: true },
      orderBy: { id: "asc" },
      take: batchSize,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });
    if (batch.length === 0) break;

    try {
      const result = await syncHubSpotActivityForLeads(
        batch.map((l) => ({ id: l.id, hubspotId: l.hubspotId! })),
        existingEngagementIds
      );
      progress.totalImported += result.totalImported;
    } catch (err) {
      progress.batchesFailed++;
      console.error("HubSpot activity bulk sync: a batch failed:", err);
    }

    progress.leadsProcessed += batch.length;
    cursorId = batch[batch.length - 1].id;
    onProgress?.(progress);

    if (batch.length < batchSize) break;
    await new Promise((resolve) => setTimeout(resolve, pauseMs));
  }

  return progress;
}
