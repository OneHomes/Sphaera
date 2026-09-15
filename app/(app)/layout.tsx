import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { shouldShowWelcome } from "@/lib/dailyWelcome";
import { AppShell } from "@/components/shell/AppShell";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/sign-in");
  }

  // PRD AE01 — Agents get redirected to the dedicated /onboarding route
  // (app/(onboarding)/) for a full-screen daily welcome/target-review
  // sequence before the rest of the app shell; Admins/Managers go
  // straight in. Gated on the fresh DB role, not the session-cached one
  // — a role change made directly in the database (e.g. via Prisma
  // Studio while testing) should take effect without a re-login.
  const dbUser = await getOrCreateCurrentUser(session);
  if (
    dbUser.role === "AGENT" &&
    shouldShowWelcome(dbUser, (session as { signedInAt?: number }).signedInAt)
  ) {
    redirect("/onboarding");
  }

  // Real closed-revenue leaderboard for the persistent top bar — sums
  // each user's Closed Won opportunities. Previously mock (fake "Agent
  // 1-10" names); now computed from real Opportunity.assignedUserId
  // data, which became available once RBAC/Productivity Index work
  // added that relation.
  const users = await prisma.user.findMany({
    include: {
      assignedOpportunities: {
        where: { stage: "Closed Won" },
        select: { value: true },
      },
    },
  });

  const leaderboard = users
    .map((u) => ({
      id: u.id,
      name: u.name,
      revenue: u.assignedOpportunities.reduce((sum, o) => sum + o.value, 0),
    }))
    .filter((entry) => entry.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return (
    <AppShell session={session} leaderboard={leaderboard}>
      {children}
    </AppShell>
  );
}
