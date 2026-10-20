import { prisma } from "../lib/prisma";
import { fetchAllHubSpotContacts } from "../lib/hubspot";
import { CONTACT_PROPERTIES, isExcludedContact } from "../lib/hubspotContactFilter";
import { syncHubSpotContactFromWebhook } from "../lib/hubspotWebhook";

// Controlled resync (2026-10-20) after wiping Sphaera's own lead data —
// brings in a small, curated batch of real, complete contacts (same
// completeness filter as every other sync path) so the new activity-
// timeline UI can be reviewed/approved before scaling back up to all of
// HubSpot. syncHubSpotContactFromWebhook is reused since it already
// creates the lead AND pulls its existing activity history in one call.

const TARGET_COUNT = 10;

async function main() {
  // Known-good picks from earlier investigation this session — real
  // contacts confirmed to have rich activity history, good for actually
  // exercising the new timeline UI rather than picking blind.
  const preferredIds = [
    "10443577872", // Mariam Zaidi — 1,475 events
    "301", // Tanweer Ahmed
    "12869176598", // Mudassar Moghal
    "58061075224", // Mohammed Babar
    "232026757259", // shahmir aqeel
  ];

  const synced: string[] = [];

  for (const id of preferredIds) {
    const outcome = await syncHubSpotContactFromWebhook(id);
    if (outcome.status === "created") {
      synced.push(outcome.leadName);
      console.log(`Synced: ${outcome.leadName} (${id})`);
    } else {
      console.log(`Skipped ${id}: ${outcome.status}`);
    }
  }

  // Top up to TARGET_COUNT from a general fetch if any preferred ones
  // didn't pan out (already a lead, excluded, etc.)
  if (synced.length < TARGET_COUNT) {
    const contacts = await fetchAllHubSpotContacts(CONTACT_PROPERTIES, 200);
    for (const contact of contacts) {
      if (synced.length >= TARGET_COUNT) break;
      if (preferredIds.includes(contact.id)) continue;
      if (isExcludedContact(contact.properties)) continue;

      const outcome = await syncHubSpotContactFromWebhook(contact.id);
      if (outcome.status === "created") {
        synced.push(outcome.leadName);
        console.log(`Synced: ${outcome.leadName} (${contact.id})`);
      }
    }
  }

  console.log(`\nDone. Synced ${synced.length} leads:`, synced);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
