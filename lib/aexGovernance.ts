import { prisma } from "./prisma";

// PLACEHOLDER THRESHOLDS — not business-approved. PRD Section 14.12
// (Anti Gaming and Governance) requires "repeated low quality activity"
// and "duplicate...events" to be identified/prevented, and "the
// governance report must show suspicious patterns, rule versions, and
// manual adjustments." Exact windows/caps below must be signed off by
// the One Homes business owner before UAT.

const DUPLICATE_WINDOW_MINUTES = 5;
const DAILY_LABEL_CAP = 20;

export type PointGuardResult =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Checks a proposed point award against basic anti-gaming rules before it
 * is created. This is deliberately simple (label-based duplicate + daily
 * cap detection) — a more sophisticated version (e.g. detecting
 * artificial stage-change loops, coordinated multi-user patterns) is a
 * future enhancement once real usage data exists to calibrate against.
 */
export async function checkPointAwardAllowed(
  userId: string,
  label: string
): Promise<PointGuardResult> {
  const windowStart = new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60_000);

  const recentDuplicate = await prisma.aexPointEvent.findFirst({
    where: { userId, label, createdAt: { gte: windowStart } },
  });

  if (recentDuplicate) {
    return {
      allowed: false,
      reason: `Duplicate of "${label}" within the last ${DUPLICATE_WINDOW_MINUTES} minutes`,
    };
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todayCount = await prisma.aexPointEvent.count({
    where: { userId, label, createdAt: { gte: startOfDay } },
  });

  if (todayCount >= DAILY_LABEL_CAP) {
    return {
      allowed: false,
      reason: `Daily cap of ${DAILY_LABEL_CAP} reached for "${label}"`,
    };
  }

  return { allowed: true };
}

export async function logSuspiciousActivity(
  userId: string,
  userEmail: string,
  label: string,
  reason: string
) {
  await prisma.auditLog.create({
    data: {
      actorId: userId,
      actorEmail: userEmail,
      action: "aex_suspicious_activity_blocked",
      targetId: null,
      details: `Blocked point award "${label}": ${reason}`,
    },
  });
}