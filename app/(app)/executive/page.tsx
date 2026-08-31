import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthUser } from "@/lib/authz";
import { getExecutiveSummary } from "@/lib/executiveDashboard";
import { ExecutiveDashboardPage } from "@/components/executive/ExecutiveDashboardPage";

export const dynamic = "force-dynamic";

export default async function ExecutiveRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const authUser = getAuthUser(session);

  // Company-wide, cross-team view — Admin only. Managers already have
  // their own team-scoped equivalents (Business Activity, Risk Centre).
  if (authUser.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const summary = await getExecutiveSummary(authUser);

  return <ExecutiveDashboardPage summary={summary} />;
}