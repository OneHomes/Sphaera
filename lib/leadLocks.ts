import { prisma } from "./prisma";
import { logAudit, SYSTEM_ACTOR } from "./auditLog";

// PLACEHOLDER DURATION — not business-approved. PRD AE08 requires a
// "configured period" for the lock; same governance pattern as the
// capacity caps in lib/allocationRules.ts.
export const LEAD_LOCK_HOURS = 48;

/**
 * Releases any lead whose lock has expired without the required first
 * activity (a logged call/email/meeting — see the interactions route)
 * back to the unassigned pool, so it can be reassigned.
 *
 * This is a lazy, on-read check rather than a scheduled job: there's no
 * background cron in this serverless architecture (same constraint noted
 * for threshold-based notifications in lib/notifications.ts), so expiry
 * is evaluated whenever the lead list is loaded instead.
 */
export async function releaseExpiredLocks(): Promise<void> {
  const now = new Date();

  const expired = await prisma.lead.findMany({
    where: { assignment: "Locked", lockedUntil: { lt: now } },
    select: { id: true },
  });

  if (expired.length === 0) return;

  const ids = expired.map((l) => l.id);

  await prisma.lead.updateMany({
    where: { id: { in: ids } },
    data: { assignment: "Unassigned", assignedUserId: null, lockedUntil: null },
  });

  await prisma.leadTimelineEvent.createMany({
    data: ids.map((leadId) => ({
      leadId,
      type: "stage_change",
      summary: "Lock expired with no logged activity — released back to the unassigned pool",
    })),
  });

  // PRD PF07 — "lead assignment and reassignment" audited category. No
  // human actor initiated this, so it's logged under a system sentinel
  // rather than attributed to whoever happened to trigger the lazy check.
  for (const leadId of ids) {
    await logAudit({
      ...SYSTEM_ACTOR,
      action: "lead_reassigned",
      targetId: leadId,
      details: "Lock expired with no logged activity — released back to the unassigned pool",
    });
  }
}
