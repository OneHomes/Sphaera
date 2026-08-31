import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { getMissionItems } from "@/lib/missionCentre";
import { getDashboardMetrics } from "@/lib/dashboardMetrics";
import { MissionCentre } from "@/components/command/MissionCentre";
import { DashboardGrid } from "@/components/dashboard/DashboardGrid";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const user = await getOrCreateCurrentUser(session);
  const [missionItems, metrics] = await Promise.all([
    getMissionItems(user.id),
    getDashboardMetrics(user.id),
  ]);

  return (
    <div>
      <div className="px-6 pt-6">
        <MissionCentre items={missionItems} />
      </div>
      <DashboardGrid metrics={metrics} />
    </div>
  );
}