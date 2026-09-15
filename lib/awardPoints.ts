import { prisma } from "./prisma";
import { checkPointAwardAllowed, logSuspiciousActivity } from "./aexGovernance";

// PRD AEX 14.1 — real automatic point awards off real events (a logged
// interaction, a lead stage advancing, a closed deal), instead of only
// the manual /api/aex/points endpoint. Every award still passes through
// the same anti-gaming guard (PRD 14.12) as the manual path. Best-effort:
// a failed/blocked award should never fail the primary action that
// triggered it — callers should catch, not propagate.
export async function awardPoints(
  userId: string,
  userEmail: string,
  label: string,
  points: number
): Promise<void> {
  const guard = await checkPointAwardAllowed(userId, label);
  if (!guard.allowed) {
    await logSuspiciousActivity(userId, userEmail, label, guard.reason);
    return;
  }
  await prisma.aexPointEvent.create({ data: { userId, label, points } });
}
