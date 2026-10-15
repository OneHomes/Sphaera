import { prisma } from "../lib/prisma";
import { syncHubSpotActivityForAllLeads } from "../lib/hubspotActivitySync";

// One-time full catch-up: syncHubSpotActivity's admin-button path only
// ever covered leadLimit=2500 leads, leaving ~190,000 of the ~191,000
// HubSpot-imported leads with no activity history at all. This runs the
// full sweep (lib/hubspotActivitySync.ts's syncHubSpotActivityForAllLeads)
// end to end, batch by batch, logging progress so it can be watched
// (and so a crash mid-run shows exactly how far it got).

async function main() {
  console.log("Starting full HubSpot activity sync across all leads...");
  const result = await syncHubSpotActivityForAllLeads((progress) => {
    console.log(
      `[${new Date().toISOString()}] ${progress.leadsProcessed}/${progress.totalLeads} leads processed, ` +
        `${progress.totalImported} events imported so far, ${progress.batchesFailed} batches failed`
    );
  });
  console.log("\nDone.");
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
