import { prisma } from "./prisma";
import { fetchAllHubSpotContacts, listHubSpotOwners, type HubSpotContact } from "./hubspot";
import { maybeCreateOpportunityFromLead } from "./leadToOpportunity";
import { generateUniqueLeadUid } from "./leadUid";
import { flagDuplicatesForLead } from "./duplicateDetection";
import {
  CONTACT_PROPERTIES,
  isExcludedContact,
  fullName,
  truthy,
  realDealValue,
  realDealCloseDate,
} from "./hubspotContactFilter";
import { originalSourceFields } from "./leadOriginalSource";

// Real HubSpot -> Sphaera Lead sync. Replaces the earlier Salesforce sync
// (lib/salesforceSync.ts, removed) — this HubSpot portal turned out to be
// fed from the same Salesforce org (every real contact carries a
// "salesforceleadid" property pointing at the same Lead IDs), so it's
// used here as the live source going forward instead of calling
// Salesforce directly.
//
// IMPORTANT data-quality difference from the old Salesforce sync: several
// HubSpot contact properties that mirror Salesforce fields (project
// interest, source, even phone) are frequently blank on this portal even
// though the equivalent Salesforce field had a real value. A blind
// "always overwrite" refresh (as the Salesforce sync safely did, since
// Salesforce's own copy was reliably populated) would therefore silently
// wipe good existing data on almost every re-sync. So on an UPDATE to an
// already-synced lead, a field is only overwritten when HubSpot actually
// has a non-empty value for it — otherwise the existing Sphaera value is
// left untouched. New leads still get sensible fallbacks.
//
// Stage, priority, engagement, assignment, and score are never touched on
// an update, same rule as the Salesforce sync: those are exactly the
// fields an agent may have already changed inside Sphaera, and this sync
// has no write-back path to HubSpot, so overwriting them risks silently
// reverting real in-app work.

/** The Lead fields refreshLeadFromHubSpot compares against. */
export const REFRESH_SELECT = {
  id: true,
  name: true,
  contact: true,
  email: true,
  source: true,
  originalSource: true,
  originalSourceDetail: true,
  projectInterest: true,
  hubspotId: true,
  estimatedValue: true,
  estimatedCloseAt: true,
} as const;

type RefreshableLead = {
  id: string;
  name: string;
  contact: string;
  email: string | null;
  source: string;
  originalSource: string | null;
  originalSourceDetail: string | null;
  projectInterest: string;
  hubspotId: string | null;
  estimatedValue: number | null;
  estimatedCloseAt: Date | null;
};

/**
 * Updates an existing lead from its HubSpot contact under the rules above
 * (only non-empty HubSpot values overwrite; stage/priority/assignment/score
 * never touched). Shared by "Sync now" and the real-time contact webhook.
 * Returns whether anything meaningful changed (and was written).
 */
export async function refreshLeadFromHubSpot(
  existing: RefreshableLead,
  hubspotContactId: string,
  p: Record<string, string | null>
): Promise<boolean> {
  const freshContact = p.phone || p.mobilephone || p.email || null;
  const freshValue = realDealValue(p);
  const freshCloseAt = realDealCloseDate(p);

  const data: Record<string, unknown> = {
    lastSyncedAt: new Date(),
  };
  if (!existing.hubspotId) data.hubspotId = hubspotContactId; // backfill legacy Salesforce-only leads
  if (truthy(p.email) || truthy(fullName(p))) data.name = fullName(p);
  if (freshContact) data.contact = freshContact;
  if (truthy(p.email)) data.email = p.email;
  if (truthy(p.leadsource)) data.source = p.leadsource;
  const original = originalSourceFields(p);
  if (original.originalSource) {
    data.originalSource = original.originalSource;
    data.originalSourceDetail = original.originalSourceDetail;
  }
  if (truthy(p.project__c)) data.projectInterest = p.project__c;
  if (freshValue !== null) data.estimatedValue = freshValue;
  if (freshCloseAt) data.estimatedCloseAt = freshCloseAt;

  const meaningfulChange =
    (data.name && data.name !== existing.name) ||
    (data.contact && data.contact !== existing.contact) ||
    (data.email && data.email !== existing.email) ||
    (data.source && data.source !== existing.source) ||
    (data.originalSource && (data.originalSource !== existing.originalSource || data.originalSourceDetail !== existing.originalSourceDetail)) ||
    (data.projectInterest && data.projectInterest !== existing.projectInterest) ||
    (data.estimatedValue !== undefined && data.estimatedValue !== existing.estimatedValue) ||
    !existing.hubspotId;

  if (!meaningfulChange) return false;
  await prisma.lead.update({ where: { id: existing.id }, data });
  return true;
}

export type HubSpotSyncResult = {
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  createdLeadNames: string[];
};

export async function syncHubSpotLeads(limit = 200): Promise<HubSpotSyncResult> {
  const [contacts, owners] = await Promise.all([
    fetchAllHubSpotContacts(CONTACT_PROPERTIES, limit),
    // Owner resolution is best-effort — the private app may not have the
    // crm.objects.owners.read scope granted yet. Leads just come through
    // "Unassigned" rather than failing the whole sync over it.
    listHubSpotOwners().catch(() => []),
  ]);

  const ownerEmailById = new Map(owners.map((o) => [o.id, o.email]));
  const sphaeraUsers = await prisma.user.findMany({ select: { id: true, email: true } });
  const userIdByEmail = new Map(sphaeraUsers.map((u) => [u.email.toLowerCase(), u.id]));

  const realContacts = contacts.filter((c) => !isExcludedContact(c.properties));

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const createdLeadNames: string[] = [];

  for (const contact of realContacts) {
   try {
    const p = contact.properties;
    const salesforceLeadId = truthy(p.salesforceleadid) ? p.salesforceleadid : null;

    const existing = await prisma.lead.findFirst({
      where: {
        OR: [
          { hubspotId: contact.id },
          ...(salesforceLeadId ? [{ salesforceId: salesforceLeadId }] : []),
        ],
      },
      select: REFRESH_SELECT,
    });

    const freshContact = p.phone || p.mobilephone || p.email || null;
    const freshValue = realDealValue(p);
    const freshCloseAt = realDealCloseDate(p);

    if (existing) {
      if (await refreshLeadFromHubSpot(existing, contact.id, p)) {
        updated++;
      } else {
        unchanged++;
      }
      await maybeCreateOpportunityFromLead(existing.id);
      continue;
    }

    const assignedUserId = p.hubspot_owner_id
      ? (userIdByEmail.get((ownerEmailById.get(p.hubspot_owner_id) ?? "").toLowerCase()) ?? null)
      : null;
    const uid = await generateUniqueLeadUid();

    const lead = await prisma.lead.create({
      data: {
        uid,
        name: fullName(p),
        contact: freshContact || "—",
        email: truthy(p.email) ? p.email : null,
        source: p.leadsource || "Other",
        ...originalSourceFields(p),
        market: "Unknown", // HubSpot has no per-contact market/currency field to pull from
        projectInterest: p.project__c || "Unspecified",
        stage: p.leadstatus || "New Lead / Not Contacted Yet",
        assignedUserId,
        assignment: assignedUserId ? "Assigned" : "Unassigned",
        prioritizationReason: "Imported from HubSpot",
        hubspotId: contact.id,
        salesforceId: salesforceLeadId,
        lastSyncedAt: new Date(),
        estimatedValue: freshValue,
        estimatedCloseAt: freshCloseAt,
        createdAt: truthy(p.createdate) ? new Date(p.createdate) : new Date(),
      },
    });

    await maybeCreateOpportunityFromLead(lead.id);
    await flagDuplicatesForLead(lead.id, lead.contact, lead.name);

    created++;
    createdLeadNames.push(fullName(p));
   } catch (err) {
    // A transient Azure SQL serverless cold-start blip (or any other
    // single-contact failure) shouldn't abort an otherwise-healthy
    // multi-hundred-contact sync — log and move on to the next contact.
    console.error(`HubSpot sync: failed to process contact ${contact.id}:`, err);
   }
  }

  return { fetched: realContacts.length, created, updated, unchanged, createdLeadNames };
}
