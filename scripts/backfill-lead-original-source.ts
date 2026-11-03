import { prisma } from "../lib/prisma";
import { batchReadObjects } from "../lib/hubspot";
import { ORIGINAL_SOURCE_PROPERTIES, originalSourceFields } from "../lib/leadOriginalSource";

// One-time fill of Lead.originalSource / originalSourceDetail (HubSpot's
// Original Source, shown on the lead timeline's "Created" entry) for leads
// imported before those columns existed. New/updated leads get them from
// the sync paths. Safe to re-run; --dry-run writes nothing.
//   npx tsx --env-file=.env scripts/backfill-lead-original-source.ts [--dry-run]

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  let updated = 0;
  let cursorId: string | undefined;
  for (;;) {
    const batch = await prisma.lead.findMany({
      where: { hubspotId: { not: null }, originalSource: null },
      select: { id: true, hubspotId: true },
      orderBy: { id: "asc" },
      take: 100,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });
    if (batch.length === 0) break;
    cursorId = batch[batch.length - 1].id;

    const contacts = await batchReadObjects("contacts", batch.map((l) => l.hubspotId!), [...ORIGINAL_SOURCE_PROPERTIES]);
    const byId = new Map(contacts.map((c) => [c.id, originalSourceFields(c.properties)]));
    for (const lead of batch) {
      const fields = byId.get(lead.hubspotId!);
      if (!fields?.originalSource) continue;
      if (!dryRun) await prisma.lead.update({ where: { id: lead.id }, data: fields });
      updated++;
    }
    console.log(`[${new Date().toISOString()}] ${updated} leads ${dryRun ? "would be " : ""}updated`);
    if (batch.length < 100) break;
  }
  console.log(`\nDone${dryRun ? " (dry run, nothing written)" : ""}: ${updated} leads.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
