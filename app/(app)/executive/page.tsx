import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFreshAuthUser } from "@/lib/authz";
import { getExecutiveSummary } from "@/lib/executiveDashboard";
import { getPilotMetrics } from "@/lib/pilotMetrics";
import { ExecutiveDashboardPage } from "@/components/executive/ExecutiveDashboardPage";

export const dynamic = "force-dynamic";

export default async function ExecutiveRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const authUser = await getFreshAuthUser(session);

  // PRD AV01/AV03 — Admin gets the company-wide view; Manager now gets
  // the same page scoped to their own team by getExecutiveSummary
  // (previously Admin-only, leaving Managers with no executive-style
  // view of their team at all). Agents still have no use for this.
  if (authUser.role === "AGENT") {
    redirect("/dashboard");
  }

  const [summary, pilotMetrics] = await Promise.all([
    getExecutiveSummary(authUser),
    getPilotMetrics(authUser),
  ]);

  return <ExecutiveDashboardPage summary={summary} pilotMetrics={pilotMetrics} />;
}