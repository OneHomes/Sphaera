import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { getAuthUser } from "@/lib/authz";
import { getMissionContext } from "@/lib/missionCentre";
import { getDashboardMetrics } from "@/lib/dashboardMetrics";
import { getTeamActivitySnapshot } from "@/lib/teamActivitySnapshot";
import { MissionCentre } from "@/components/command/MissionCentre";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const user = await getOrCreateCurrentUser(session);
  const authUser = getAuthUser(session);
  const [metrics, teamActivity] = await Promise.all([
    getDashboardMetrics(user.id),
    getTeamActivitySnapshot(authUser),
  ]);

  // Mission Centre is a personal, frontline-agent concept (PRD AE04) —
  // Manager/Admin don't have one, so their Dashboard is the plain widget
  // grid only, matching the reference UI exactly (no tab switcher at
  // all), rather than a tab with nothing meaningful behind it. Gated on
  // the fresh DB role (user.role), not the session-cached one, for the
  // same reason as the other role gates added this session — a role
  // change shouldn't need a re-login to take effect.
  if (user.role !== "AGENT") {
    return <DashboardGrid metrics={metrics} teamActivity={teamActivity} />;
  }

  const missionContext = await getMissionContext(user.id);

  return (
    <DashboardTabs
      mission={<MissionCentre {...missionContext} />}
      dashboard={<DashboardGrid metrics={metrics} teamActivity={teamActivity} />}
    />
  );
}
