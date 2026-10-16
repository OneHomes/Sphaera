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

// Azure SQL serverless connectivity has been genuinely flaky this
// session — not just single blips, but stretches of several consecutive
// failures (seen both here and from a separate agent earlier). A short,
// bounded retry wasn't enough to ride that out and crashed the process
// twice already. This retries for much longer (up to ~20 minutes per
// call) before giving up, since the alternative is a human having to
// notice the crash and restart it by hand.
async function withDbRetry<T>(fn: () => Promise<T>, attempts = 40): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.error(`DB call failed (attempt ${i + 1}/${attempts}), retrying:`, err instanceof Error ? err.message : err);
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, Math.min(30000, 1000 * 2 ** i)));
    }
  }
  throw lastErr;
}

async function main() {
  const totalLeads = await withDbRetry(() =>
    prisma.lead.count({ where: { hubspotId: { not: null }, email: null } })
  );
  console.log(`Backfilling email for ${totalLeads} leads missing it...`);

  let processed = 0;
  let updated = 0;
  let cursorId: string | undefined;

  for (;;) {
    // Top-level guard, not just around individual DB calls — if
    // anything in this iteration throws after withDbRetry's own budget
    // is exhausted, log it and try the same cursor position again after
    // a cooldown rather than letting the whole multi-hour run die.
    try {
      const batch = await withDbRetry(() =>
        prisma.lead.findMany({
          where: { hubspotId: { not: null }, email: null },
          select: { id: true, hubspotId: true },
          orderBy: { id: "asc" },
          take: BATCH_SIZE,
          ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
        })
      );
      if (batch.length === 0) break;

      const contacts = await batchReadObjects(
        "contacts",
        batch.map((l) => l.hubspotId!),
        ["email"]
      );
      const emailById = new Map(contacts.map((c) => [c.id, c.properties.email]));

      for (const lead of batch) {
        const email = emailById.get(lead.hubspotId!);
        if (typeof email === "string" && email.trim()) {
          await withDbRetry(() => prisma.lead.update({ where: { id: lead.id }, data: { email: email.trim() } }));
          updated++;
        }
      }

      processed += batch.length;
      cursorId = batch[batch.length - 1].id;
      if (processed % 2000 === 0) console.log(`${processed}/${totalLeads} processed, ${updated} emails filled in so far`);

      if (batch.length < BATCH_SIZE) break;
      await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    } catch (err) {
      console.error(
        `Iteration at cursor ${cursorId ?? "(start)"} failed even after retries — cooling down 60s before trying again:`,
        err instanceof Error ? err.message : err
      );
      await new Promise((resolve) => setTimeout(resolve, 60000));
    }
  }

  console.log(`\nDone. Processed ${processed}, filled in email for ${updated} leads.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
