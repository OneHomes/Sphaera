import { prisma } from "../lib/prisma";

// Full reset of Sphaera's OWN lead data (2026-10-20) — HubSpot itself is
// never touched by this, it's the source of truth we'll re-sync from
// later. This clears the slate so a small, curated set of real leads can
// be brought in next with the new activity-timeline UI, reviewed and
// approved, before scaling back up to everything.
//
// Delete order matters: dependents first, Lead last, since
// Opportunity/LeadTag/etc. reference Lead with onDelete: NoAction (not
// Cascade) — see each model's comment in prisma/schema.prisma for why.

async function main() {
  const leadCount = await prisma.lead.count();
  console.log(`About to wipe ${leadCount} leads and all related data from Sphaera's database...`);

  const duplicateFlags = await prisma.duplicateLeadFlag.deleteMany({});
  console.log(`Deleted ${duplicateFlags.count} duplicate lead flags`);

  const tags = await prisma.leadTag.deleteMany({});
  console.log(`Deleted ${tags.count} lead tags (and their tag removal requests, via cascade)`);

  const notes = await prisma.leadNote.deleteMany({});
  console.log(`Deleted ${notes.count} lead notes`);

  const timeline = await prisma.leadTimelineEvent.deleteMany({});
  console.log(`Deleted ${timeline.count} timeline events`);

  const opportunities = await prisma.opportunity.deleteMany({});
  console.log(`Deleted ${opportunities.count} opportunities`);

  const leads = await prisma.lead.deleteMany({});
  console.log(`Deleted ${leads.count} leads`);

  console.log("\nDone. Sphaera's lead database is now empty. HubSpot itself was never touched.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
