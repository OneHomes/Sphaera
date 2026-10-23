import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/authz";
import { withTenantPage } from "@/lib/withTenant";
import { getVisibleTargets } from "@/lib/targetTracker";
import { TargetsPage } from "@/components/targets/TargetsPage";

export const dynamic = "force-dynamic";

export default async function TargetsRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async (authUser) => {
    const canManage = hasRole(authUser, ["MANAGER", "ADMIN"]);

    const [targets, teams] = await Promise.all([
      getVisibleTargets(authUser.id, authUser.teamId),
      canManage ? prisma.team.findMany({ orderBy: { name: "asc" } }) : [],
    ]);

    return (
      <TargetsPage
        targets={targets}
        teams={teams.map((t) => ({ id: t.id, name: t.name }))}
        currentUserId={authUser.id}
        canManage={canManage}
      />
    );
  });
}