import { createSuperchatWebhook, listSuperchatWebhooks } from "../lib/superchat";

// Registers Sphaera's Superchat webhook (message_inbound + message_outbound)
// once SUPERCHAT_WEBHOOK_TOKEN is set in the live app's environment.
// Without --create it only lists what's registered.
//   SUPERCHAT_API_KEY=... SUPERCHAT_WEBHOOK_TOKEN=... npx tsx scripts/setup-superchat-webhook.ts [--create]

const TARGET = "https://apex.sphaera.tech/api/webhooks/superchat";

async function main() {
  const existing = await listSuperchatWebhooks();
  const ours = existing.filter((w) => w.target_url.startsWith(TARGET));
  console.log(`Registered webhooks: ${existing.length} (ours: ${ours.length})`);
  for (const w of ours) console.log(`  ${w.id} events=${(w.events ?? []).map((e) => e.type).join(",")}`);

  if (!process.argv.includes("--create")) return;
  if (ours.length > 0) {
    console.log("Already registered — nothing to do.");
    return;
  }
  const token = process.env.SUPERCHAT_WEBHOOK_TOKEN;
  if (!token) throw new Error("SUPERCHAT_WEBHOOK_TOKEN not set");
  const created = await createSuperchatWebhook(`${TARGET}?token=${encodeURIComponent(token)}`);
  console.log(`Created webhook ${created.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
