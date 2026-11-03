import { prisma } from "../lib/prisma";
import { syncSakariHistory } from "../lib/sakariHistory";

// Catch-up of past Sakari SMS onto lead timelines (see lib/sakariHistory.ts).
//   SAKARI_ACCOUNT_ID=... SAKARI_CLIENT_ID=... SAKARI_CLIENT_SECRET=... \
//     npx tsx --env-file=.env scripts/sync-sakari-history.ts [--dry-run]

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const result = await syncSakariHistory({
    dryRun,
    onProgress: (r) => {
      if (r.leadsChecked % 25 === 0) console.log(`[${new Date().toISOString()}] ${JSON.stringify(r)}`);
    },
  });
  console.log(`\nDone${dryRun ? " (dry run, nothing written)" : ""}.`);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
