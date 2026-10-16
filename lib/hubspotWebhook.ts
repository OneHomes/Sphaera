import { prisma } from "./prisma";
import { batchReadObjects, listHubSpotOwners } from "./hubspot";
import {
  CONTACT_PROPERTIES,
  isExcludedContact,
  fullName,
  truthy,
  realDealValue,
  realDealCloseDate,
} from "./hubspotContactFilter";
import { generateUniqueLeadUid } from "./leadUid";
import { flagDuplicatesForLead } from "./duplicateDetection";
import { maybeCreateOpportunityFromLead } from "./leadToOpportunity";
import { createNotification } from "./notifications";
import { logAudit } from "./auditLog";
import { syncHubSpotActivityForLeads } from "./hubspotActivitySync";

// Real-time counterpart to lib/hubspotSync.ts — instead of an admin
// periodically clicking "Sync now", HubSpot pushes a webhook event the
// instant a contact is created (see app/api/webhooks/hubspot/route.ts),
// and this creates the lead immediately and notifies whoever it landed
// with, same pattern as a manual lead assignment notification.

export type WebhookSyncOutcome =
  | { status: "created"; leadId: string; leadName: string }
  | { status: "excluded" }
  | { status: "already_exists"; leadId: string }
  | { status: "not_found" };

export async function syncHubSpotContactFromWebhook(hubspotContactId: string): Promise<WebhookSyncOutcome> {
  const [contacts, owners] = await Promise.all([
    batchReadObjects("contacts", [hubspotContactId], CONTACT_PROPERTIES),
    listHubSpotOwners().catch(() => []),
  ]);
  const contact = contacts[0];
  if (!contact) return { status: "not_found" };

  const p = contact.properties;
  if (isExcludedContact(p)) return { status: "excluded" };

  const salesforceLeadId = truthy(p.salesforceleadid) ? p.salesforceleadid : null;
  const existing = await prisma.lead.findFirst({
    where: {
      OR: [{ hubspotId: hubspotContactId }, ...(salesforceLeadId ? [{ salesforceId: salesforceLeadId }] : [])],
    },
    select: { id: true },
  });
  if (existing) return { status: "already_exists", leadId: existing.id };

  const ownerEmailById = new Map(owners.map((o) => [o.id, o.email]));
  const sphaeraUsers = await prisma.user.findMany({ select: { id: true, email: true } });
  const userIdByEmail = new Map(sphaeraUsers.map((u) => [u.email.toLowerCase(), u.id]));
  const assignedUserId = p.hubspot_owner_id
    ? (userIdByEmail.get((ownerEmailById.get(p.hubspot_owner_id) ?? "").toLowerCase()) ?? null)
    : null;

  const freshContact = p.phone || p.mobilephone || p.email || "—";
  const name = fullName(p);
  const uid = await generateUniqueLeadUid();

  const lead = await prisma.lead.create({
    data: {
      uid,
      name,
      contact: freshContact,
      email: truthy(p.email) ? p.email : null,
      source: p.leadsource || "Other",
      market: "Unknown",
      projectInterest: p.project__c || "Unspecified",
      stage: p.leadstatus || "New Lead / Not Contacted Yet",
      assignedUserId,
      assignment: assignedUserId ? "Assigned" : "Unassigned",
      prioritizationReason: "Imported from HubSpot (real-time)",
      hubspotId: hubspotContactId,
      salesforceId: salesforceLeadId,
      lastSyncedAt: new Date(),
      estimatedValue: realDealValue(p),
      estimatedCloseAt: realDealCloseDate(p),
      createdAt: truthy(p.createdate) ? new Date(p.createdate) : new Date(),
    },
  });

  await maybeCreateOpportunityFromLead(lead.id);
  await flagDuplicatesForLead(lead.id, lead.contact, lead.name);

  // A contact can already have real HubSpot history by the time its
  // creation webhook fires here (e.g. it existed in HubSpot for a while
  // before matching Sphaera's import filters, or before today's filter
  // rules let it through) — pull that in immediately rather than leaving
  // the lead's timeline empty until the next full sweep.
  await syncHubSpotActivityForLeads([{ id: lead.id, hubspotId: hubspotContactId }], new Set()).catch((err) =>
    console.error(`HubSpot webhook: activity pull failed for new lead ${lead.id}:`, err)
  );

  // Notify whoever it's for — the assigned agent if HubSpot's owner
  // resolved to a real Sphaera user, otherwise every Admin so the
  // unassigned pool doesn't go unnoticed.
  if (assignedUserId) {
    await createNotification(
      assignedUserId,
      "hubspot_lead_synced",
      "New lead from HubSpot",
      `${lead.name} — ${lead.stage}`,
      `/leads/${lead.id}`
    );
  } else {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    await Promise.all(
      admins.map((admin) =>
        createNotification(
          admin.id,
          "hubspot_lead_synced",
          "New unassigned lead from HubSpot",
          `${lead.name} — ${lead.stage}`,
          `/leads/${lead.id}`
        )
      )
    );
  }

  await logAudit({
    actorId: "system",
    actorEmail: "hubspot-webhook",
    action: "hubspot_lead_synced_realtime",
    targetId: lead.id,
    details: `${lead.name} created in real time from HubSpot contact ${hubspotContactId}`,
  });

  return { status: "created", leadId: lead.id, leadName: lead.name };
}
