import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthUser } from "@/lib/authz";
import { getRiskAlerts } from "@/lib/riskCentre";
import { RiskCentrePage } from "@/components/riskcentre/RiskCentrePage";

export const dynamic = "force-dynamic";

export default async function RiskCentreRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const authUser = getAuthUser(session);
  if (authUser.role === "AGENT") {
    redirect("/dashboard");
  }

  const alerts = await getRiskAlerts(authUser);

  return <RiskCentrePage alerts={alerts} />;
}