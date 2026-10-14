import { randomUUID } from "crypto";
import { prisma } from "./prisma";
import { streamAllHubSpotContacts, listHubSpotOwners, type HubSpotContact } from "./hubspot";
import { normalizeContact } from "./duplicateDetection";
import { leadStageRank } from "./leadData";
import { maybeCreateOpportunityFromLead } from "./leadToOpportunity";
import {
  CONTACT_PROPERTIES,
  isExcludedContact,
  fullName,
  truthy,
  realDealValue,
  realDealCloseDate,
} from "./hubspotContactFilter";

// One-time bulk catch-up: the regular syncHubSpotLeads (lib/hubspotSync.ts)
// only ever pulled the first ~2000 contacts, but the real HubSpot account
// has ~194,000. That per-contact-DB-lookup design (one findFirst, one
// generateUniqueLeadUid query, one full-table-scan duplicate check PER
// CONTACT) is completely infeasible at this scale — the duplicate check
// alone would be doing an O(n^2) full lead-table scan growing to ~194,000
// rows by the end of the run. This module exists specifically for that
// scale: pre-loads everything it can into memory once, then streams
// HubSpot's pages and bulk-inserts, never re-querying per contact.
//
// Exclusion rules (domains, "test", missing name/email/phone) live in
// lib/hubspotContactFilter.ts, shared with the regular sync and the
// real-time webhook.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomUidLocal(): string {
  let suffix = "";
  for (let i = 0; i < 8; i++) suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `SPH-${suffix}`;
}

export type BulkImportResult = {
  totalSeen: number;
  excluded: number;
  created: number;
  updated: number;
  unchanged: number;
  duplicateFlagsCreated: number;
  pagesFailed: number;
};

export async function bulkImportHubSpotLeads(
  onProgress?: (result: BulkImportResult) => void,
  maxPages?: number // testing only — leave undefined in production to import everything
): Promise<BulkImportResult> {
  console.error("[bulkImport] fetching owners...");
  const [owners] = await Promise.all([listHubSpotOwners().catch(() => [])]);
  console.error(`[bulkImport] got ${owners.length} owners`);
  const ownerEmailById = new Map(owners.map((o) => [o.id, o.email]));
  const sphaeraUsers = await prisma.user.findMany({ select: { id: true, email: true } });
  const userIdByEmail = new Map(sphaeraUsers.map((u) => [u.email.toLowerCase(), u.id]));
  console.error(`[bulkImport] got ${sphaeraUsers.length} sphaera users`);

  // Pre-load every existing lead once — replaces a per-contact DB lookup.
  const existingLeads = await prisma.lead.findMany({
    select: { id: true, name: true, contact: true, stage: true, hubspotId: true, salesforceId: true },
  });
  console.error(`[bulkImport] got ${existingLeads.length} existing leads`);
  const byHubspotId = new Map(existingLeads.filter((l) => l.hubspotId).map((l) => [l.hubspotId!, l]));
  const bySalesforceId = new Map(existingLeads.filter((l) => l.salesforceId).map((l) => [l.salesforceId!, l]));

  // In-memory duplicate index — replaces the per-lead full-table-scan
  // duplicate check, which is the one piece of the normal sync path that
  // is genuinely infeasible at this scale (O(n^2) over ~194,000 rows).
  const contactIndex = new Map<string, { leadId: string; name: string }[]>();
  for (const l of existingLeads) {
    const key = normalizeContact(l.contact);
    if (!key) continue;
    const bucket = contactIndex.get(key) ?? [];
    bucket.push({ leadId: l.id, name: l.name });
    contactIndex.set(key, bucket);
  }

  const result: BulkImportResult = {
    totalSeen: 0,
    excluded: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    duplicateFlagsCreated: 0,
    pagesFailed: 0,
  };

  async function processPage(contacts: HubSpotContact[]) {
    result.totalSeen += contacts.length;
    const newRows: {
      id: string;
      uid: string;
      name: string;
      contact: string;
      source: string;
      market: string;
      projectInterest: string;
      stage: string;
      assignedUserId: string | null;
      assignment: string;
      prioritizationReason: string;
      hubspotId: string;
      salesforceId: string | null;
      lastSyncedAt: Date;
      estimatedValue: number | null;
      estimatedCloseAt: Date | null;
      createdAt: Date;
    }[] = [];
    const duplicateFlags: { leadId: string; duplicateOfId: string; matchReason: string }[] = [];
    const pendingIndexAdditions: { key: string; leadId: string; name: string }[] = [];

    for (const contact of contacts) {
      const p = contact.properties;
      if (isExcludedContact(p)) {
        result.excluded++;
        continue;
      }

      const salesforceLeadId = truthy(p.salesforceleadid) ? p.salesforceleadid : null;
      const existing = byHubspotId.get(contact.id) ?? (salesforceLeadId ? bySalesforceId.get(salesforceLeadId) : undefined);

      const freshContact = p.phone || p.mobilephone || p.email || null;
      const freshValue = realDealValue(p);
      const freshCloseAt = realDealCloseDate(p);

      // This bulk pass exists specifically to catch up the ~190,000+
      // contacts never synced before — leads already known to Sphaera are
      // intentionally left untouched here (no comparison, no update call)
      // rather than doing a per-row UPDATE for all ~2,200 of them on
      // every run. The existing "Sync now" button (lib/hubspotSync.ts)
      // already owns keeping those fresh; doing it here too, for every
      // contact in every page, is exactly what made the first version of
      // this slow enough to look hung.
      if (existing) {
        result.unchanged++;
        continue;
      }

      const assignedUserId = p.hubspot_owner_id
        ? (userIdByEmail.get((ownerEmailById.get(p.hubspot_owner_id) ?? "").toLowerCase()) ?? null)
        : null;
      const name = fullName(p);
      const leadContact = freshContact || "—";
      const id = randomUUID();
      const stage = p.leadstatus || "New Lead / Not Contacted Yet";

      // Astronomically low collision odds (32^8 combinations) — the DB
      // check-and-retry this normally goes through is a safety net, not
      // a real expectation, per lib/leadUid.ts's own comment. Skipped
      // here deliberately: a DB round-trip per contact is not viable
      // across ~194,000 contacts.
      const uid = randomUidLocal();

      newRows.push({
        id,
        uid,
        name,
        contact: leadContact,
        source: p.leadsource || "Other",
        market: "Unknown",
        projectInterest: p.project__c || "Unspecified",
        stage,
        assignedUserId,
        assignment: assignedUserId ? "Assigned" : "Unassigned",
        prioritizationReason: "Imported from HubSpot (bulk)",
        hubspotId: contact.id,
        salesforceId: salesforceLeadId,
        lastSyncedAt: new Date(),
        estimatedValue: freshValue,
        estimatedCloseAt: freshCloseAt,
        createdAt: truthy(p.createdate) ? new Date(p.createdate) : new Date(),
      });

      const key = normalizeContact(leadContact);
      if (key) {
        const matches = contactIndex.get(key) ?? [];
        for (const m of matches) {
          duplicateFlags.push({ leadId: id, duplicateOfId: m.leadId, matchReason: "Same contact info" });
        }
        pendingIndexAdditions.push({ key, leadId: id, name });
      }
    }

    if (newRows.length > 0) {
      await prisma.lead.createMany({ data: newRows });
      result.created += newRows.length;
      // Only commit this page's new contacts into the shared duplicate
      // index once we know they actually persisted — if createMany threw
      // above, this line never runs, so a failed page can never poison
      // later pages' duplicate checks with a leadId that was never
      // actually created (which otherwise surfaces as a foreign-key
      // violation on a LATER page's duplicateLeadFlag insert).
      for (const { key, leadId, name } of pendingIndexAdditions) {
        const matches = contactIndex.get(key) ?? [];
        contactIndex.set(key, [...matches, { leadId, name }]);
      }

      // Deal-rank check is cheap (pure in-memory rank lookup) and skips
      // the DB call entirely for the vast majority that aren't deal-rank.
      for (const row of newRows) {
        if ((leadStageRank[row.stage] ?? 0) >= 6) {
          await maybeCreateOpportunityFromLead(row.id);
        }
      }
    }
    if (duplicateFlags.length > 0) {
      await prisma.duplicateLeadFlag.createMany({ data: duplicateFlags });
      result.duplicateFlagsCreated += duplicateFlags.length;
    }

    onProgress?.(result);
  }

  let pageCount = 0;
  console.error(`[bulkImport] starting page stream (${existingLeads.length} already known)...`);
  await streamAllHubSpotContacts(CONTACT_PROPERTIES, async (page) => {
    pageCount++;
    if (pageCount % 50 === 0) console.error(`[bulkImport] page ${pageCount} (${pageCount * 100} contacts seen so far)`);
    try {
      await processPage(page);
    } catch (err) {
      result.pagesFailed++;
      console.error("HubSpot bulk import: a page of 100 contacts failed:", err);
    }
    if (maxPages !== undefined && pageCount >= maxPages) return false;
  });

  return result;
}
