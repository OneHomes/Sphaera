import { prisma } from "./prisma";
import { logAudit } from "./auditLog";

// PRD AEX 14.8 (Badges). Previously the only badge ever awarded was
// "Getting Started" at signup (lib/currentUser.ts) — nothing else ever
// triggered one. This adds real triggers off events that already exist:
// a first Closed Won opportunity, a 7-day activity streak, and a fast
// (<1h) first response to a new lead. Dedup by (userId, name) so a
// trigger firing more than once (e.g. two Closed Won opportunities)
// doesn't award the same badge twice.

export async function awardBadgeIfNew(
  userId: string,
  name: string,
  description: string
): Promise<void> {
  const existing = await prisma.userBadge.findFirst({ where: { userId, name } });
  if (existing) return;
  await prisma.userBadge.create({ data: { userId, name, description } });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  await logAudit({
    actorId: userId,
    actorEmail: user?.email ?? "unknown",
    action: "badge_awarded",
    targetId: userId,
    details: `Awarded "${name}" — ${description}`,
  });
}
