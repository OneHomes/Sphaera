import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { shouldShowWelcome } from "@/lib/dailyWelcome";
import { AppShell } from "@/components/shell/AppShell";
import { withTenantPage } from "@/lib/withTenant";

export const dynamic = "force-dynamic";

// The top-bar revenue leaderboard ran on EVERY page load (every user plus all their Closed Won
// deals). It changes only when deals close, so it is cached per organization for 2 minutes.
const LEADERBOARD_TTL_MS = 2 * 60_000;
const leaderboardCache = new Map<string, { at: number; value: Promise<{ id: string; name: string; revenue: number }[]> }>();

function getLeaderboard(organizationId: string) {
  const hit = leaderboardCache.get(organizationId);
  if (hit && Date.now() - hit.at < LEADERBOARD_TTL_MS) return hit.value;
  const value = prisma.opportunity
    .groupBy({
      by: ["assignedUserId"],
      where: { stage: "Closed Won", assignedUserId: { not: null } },
      _sum: { value: true },
    })
    .then(async (rows) => {
      const top = rows
        .map((r) => ({ id: r.assignedUserId as string, revenue: r._sum.value ?? 0 }))
        .filter((r) => r.revenue > 0)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);
      const names = new Map(
        (await prisma.user.findMany({ where: { id: { in: top.map((t) => t.id) } }, select: { id: true, name: true } })).map((u) => [u.id, u.name])
      );
      return top.map((t) => ({ id: t.id, name: names.get(t.id) ?? "Unknown", revenue: t.revenue }));
    });
  leaderboardCache.set(organizationId, { at: Date.now(), value });
  value.catch(() => leaderboardCache.delete(organizationId));
  return value;
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async (authUser) => {
    // PRD AE01 — Agents get redirected to the dedicated /onboarding route
    // (app/(onboarding)/) for a full-screen daily welcome/target-review
    // sequence before the rest of the app shell; Admins/Managers go
    // straight in. Gated on the fresh DB role, not the session-cached one
    // — a role change made directly in the database (e.g. via Prisma
    // Studio while testing) should take effect without a re-login.
    //
    // authUser (above) already resolved this same User row once via
    // withTenantPage's getFreshAuthUser() — re-fetching the full row here
    // via getOrCreateCurrentUser() was a second redundant DB round-trip
    // for every single page load under this layout (every page). Only
    // the two welcome-specific fields AuthUser doesn't carry are fetched
    // here, and only for the role that can actually need them.
    if (authUser.role === "AGENT") {
      const welcomeFields = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: { lastWelcomeAckDate: true, lastWelcomeAckSignedInAt: true },
      });
      if (
        welcomeFields &&
        shouldShowWelcome(welcomeFields, (session as { signedInAt?: number }).signedInAt)
      ) {
        redirect("/onboarding");
      }
    }

    // Real closed-revenue leaderboard for the persistent top bar — sums
    // each user's Closed Won opportunities. Previously mock (fake "Agent
    // 1-10" names); now computed from real Opportunity.assignedUserId
    // data, which became available once RBAC/Productivity Index work
    // added that relation.
    const leaderboard = await getLeaderboard(authUser.organizationId);

    return (
      <AppShell
        session={session}
        leaderboard={leaderboard}
        canAccessFinance={authUser.canAccessFinance}
      >
        {children}
      </AppShell>
    );
  });
}
