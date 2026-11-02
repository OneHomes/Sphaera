import { prisma } from "../lib/prisma";
import { syncSuperchatHistoryForLeads } from "../lib/superchat";

// One-time catch-up of WhatsApp history from Superchat onto every lead's
// timeline (the webhook only covers messages from when it was registered
// onward). Safe to re-run: messages already imported are skipped.
//   SUPERCHAT_API_KEY=... npx tsx --env-file=.env scripts/sync-superchat-history.ts

async function main() {
  const result = await syncSuperchatHistoryForLeads((r) => {
    if (r.leadsChecked % 25 === 0) console.log(`[${new Date().toISOString()}] ${JSON.stringify(r)}`);
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
