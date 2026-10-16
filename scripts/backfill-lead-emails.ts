import { prisma } from "../lib/prisma";
import { batchReadObjects } from "../lib/hubspot";

// One-time backfill for the new Lead.email column (2026-10-16) — every
// sync path now sets it going forward, but the ~191,000 leads imported
// before this field existed need their email pulled from HubSpot
// directly. `contact` is left untouched (phone still wins there, same
// as always); this only fills the new, separate `email` column so it
// shows up in the UI even when a phone number is also present.

const BATCH_SIZE = 100; // matches batchReadObjects' own per-request chunk size
const PAUSE_MS = 200; // same throttling reasoning as the other full sweeps this session

async function main() {
  const totalLeads = await prisma.lead.count({ where: { hubspotId: { not: null }, email: null } });
  console.log(`Backfilling email for ${totalLeads} leads missing it...`);

  let processed = 0;
  let updated = 0;
  let cursorId: string | undefined;

  for (;;) {
    const batch = await prisma.lead.findMany({
      where: { hubspotId: { not: null }, email: null },
      select: { id: true, hubspotId: true },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });
    if (batch.length === 0) break;

    try {
      const contacts = await batchReadObjects(
        "contacts",
        batch.map((l) => l.hubspotId!),
        ["email"]
      );
      const emailById = new Map(contacts.map((c) => [c.id, c.properties.email]));

      for (const lead of batch) {
        const email = emailById.get(lead.hubspotId!);
        if (typeof email === "string" && email.trim()) {
          await prisma.lead.update({ where: { id: lead.id }, data: { email: email.trim() } });
          updated++;
        }
      }
    } catch (err) {
      console.error(`Batch starting at lead ${batch[0].id} failed, will need a re-run to pick it up:`, err instanceof Error ? err.message : err);
    }

    processed += batch.length;
    cursorId = batch[batch.length - 1].id;
    if (processed % 2000 === 0) console.log(`${processed}/${totalLeads} processed, ${updated} emails filled in so far`);

    if (batch.length < BATCH_SIZE) break;
    await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
  }

  console.log(`\nDone. Processed ${processed}, filled in email for ${updated} leads.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
