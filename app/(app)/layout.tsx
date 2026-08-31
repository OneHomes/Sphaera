import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/shell/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/sign-in");
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