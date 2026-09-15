import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { getWelcomeData, getTargetComparison, getTierProgress } from "@/lib/dailyWelcome";
import { getDailyBriefingData } from "@/lib/dailyBriefing";
import { getMissionItems } from "@/lib/missionCentre";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const user = await getOrCreateCurrentUser(session);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [welcomeData, targetComparison, tierProgress, briefingData, missionItems, mindStateToday] =
    await Promise.all([
      getWelcomeData(user.id, user.teamId),
      getTargetComparison(user.id, user.teamId),
      getTierProgress(user.id),
      // Best-effort: an AI outage shouldn't block the whole sign-in sequence.
      getDailyBriefingData(user.id).catch(() => null),
      getMissionItems(user.id),
      prisma.mindStateCheckIn.findFirst({
        where: { userId: user.id, createdAt: { gte: todayStart } },
      }),
    ]);

  // "Our goal is to get X leads [actioned]" (final quote screen) — real
  // count from Mission Centre, not an invented figure.
  const leadsGoalCount = missionItems.filter(
    (i) => i.type === "overdue_lead" || i.type === "due_lead"
  ).length;

  return (
    <OnboardingFlow
      userName={user.name}
      welcomeData={welcomeData}
      targetComparison={targetComparison}
      tierProgress={tierProgress}
      janusInsight={briefingData?.briefing ?? null}
      leadsGoalCount={leadsGoalCount}
      skipMindState={Boolean(mindStateToday)}
    />
  );
}
