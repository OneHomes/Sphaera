import { prisma } from "../lib/prisma";
import { batchReadObjects } from "../lib/hubspot";

// Retroactive cleanup for the "must have name AND email AND phone"
// rule confirmed 2026-10-14, applied AFTER the full bulk import already
// ran. The Lead table's single "contact" field can't tell us whether it
// came from email or phone, so this re-checks real HubSpot data for
// every already-imported lead rather than guessing from what's stored.
function truthy(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

async function main() {
  const leads = await prisma.lead.findMany({
    where: { hubspotId: { not: null } },
    select: { id: true, hubspotId: true },
  });
  console.log(`Checking ${leads.length} HubSpot-imported leads against live data...`);

  const idsToRemove: string[] = [];
  let checked = 0;

  for (let i = 0; i < leads.length; i += 100) {
    const chunk = leads.slice(i, i + 100);
    const hubspotIds = chunk.map((l) => l.hubspotId!);
    let contacts;
    try {
      contacts = await batchReadObjects("contacts", hubspotIds, ["firstname", "lastname", "email", "phone", "mobilephone"]);
    } catch (err) {
      console.error(`Batch at ${i} failed, skipping (will need a re-run):`, err instanceof Error ? err.message : err);
      continue;
    }
    const byId = new Map(contacts.map((c) => [c.id, c.properties]));

    for (const lead of chunk) {
      const p = byId.get(lead.hubspotId!);
      if (!p) continue; // contact no longer exists in HubSpot — leave alone, separate concern
      const hasName = truthy(p.firstname) || truthy(p.lastname);
      const hasEmail = truthy(p.email);
      const hasPhone = truthy(p.phone) || truthy(p.mobilephone);
      if (!hasName || !hasEmail || !hasPhone) idsToRemove.push(lead.id);
    }

    checked += chunk.length;
    if (checked % 5000 === 0) console.log(`checked ${checked}/${leads.length}, flagged ${idsToRemove.length} so far`);

    // Throttled for the same reason as lib/hubspotBulkImport.ts and
    // lib/hubspotActivitySync.ts's full sweep — an unthrottled loop this
    // long hammering Azure SQL + HubSpot concurrently with live traffic
    // is what caused a real production outage earlier this session.
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log(`\nTotal flagged for removal (missing name/email/phone): ${idsToRemove.length}`);

  for (let i = 0; i < idsToRemove.length; i += 500) {
    const ids = idsToRemove.slice(i, i + 500);
    await prisma.duplicateLeadFlag.deleteMany({ where: { OR: [{ leadId: { in: ids } }, { duplicateOfId: { in: ids } }] } });
    await prisma.leadTag.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.leadNote.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.leadTimelineEvent.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.opportunity.deleteMany({ where: { leadId: { in: ids } } });
    await prisma.lead.deleteMany({ where: { id: { in: ids } } });
    console.log(`removed batch ${i}-${i + ids.length}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  console.log("\nDone. Removed:", idsToRemove.length);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
