import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthUser, hasRole } from "@/lib/authz";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { getVisibleTargets } from "@/lib/targetTracker";
import { TargetsPage } from "@/components/targets/TargetsPage";

export const dynamic = "force-dynamic";

export default async function TargetsRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const authUser = getAuthUser(session);
  const user = await getOrCreateCurrentUser(session);
  const canManage = hasRole(authUser, ["MANAGER", "ADMIN"]);

  const [targets, teams] = await Promise.all([
    getVisibleTargets(user.id, user.teamId),
    canManage ? prisma.team.findMany({ orderBy: { name: "asc" } }) : [],
  ]);

  return (
    <TargetsPage
      targets={targets}
      teams={teams.map((t) => ({ id: t.id, name: t.name }))}
      currentUserId={user.id}
      canManage={canManage}
    />
  );
}