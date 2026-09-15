import { prisma } from "./prisma";
import { calculateProductivityIndex } from "./productivityIndex";
import type { AuthUser } from "./authz";

// The mockup's Dashboard "Agent Activity Index" widget shows multiple
// named agents — that only makes honest sense for a Manager/Admin (real
// team data), not on a single Agent's personal dashboard, which is why
// this is gated by role rather than shown to everyone. Reuses the exact
// same real Productivity Index + "active" signal as the Business
// Activity page (app/(app)/business-activity/page.tsx), just capped to
// a top-5 snapshot instead of the full roster.

export type TeamActivityRow = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  productivityIndex: number;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function getTeamActivitySnapshot(
  authUser: AuthUser
): Promise<TeamActivityRow[] | null> {
  if (authUser.role === "AGENT") return null;

  const userWhere =
    authUser.role === "MANAGER" && authUser.teamId
      ? { teamId: authUser.teamId }
      : {};

  const users = await prisma.user.findMany({
    where: userWhere,
    include: { pointEvents: true },
  });

  const productivityIndexes = await Promise.all(
    users.map((u) => calculateProductivityIndex(u.id))
  );

  const rows: TeamActivityRow[] = users.map((u, i) => {
    const mostRecentEvent = u.pointEvents.reduce<Date | null>((latest, e) => {
      return !latest || e.createdAt > latest ? e.createdAt : latest;
    }, null);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      isActive:
        mostRecentEvent !== null && Date.now() - mostRecentEvent.getTime() < ONE_DAY_MS,
      productivityIndex: productivityIndexes[i].overall,
    };
  });

  return rows.sort((a, b) => b.productivityIndex - a.productivityIndex).slice(0, 5);
}
