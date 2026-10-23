import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRiskAlerts } from "@/lib/riskCentre";
import { RiskCentrePage } from "@/components/riskcentre/RiskCentrePage";
import { withTenantPage } from "@/lib/withTenant";

export const dynamic = "force-dynamic";

export default async function RiskCentreRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async (authUser) => {
    if (authUser.role === "AGENT") {
      redirect("/dashboard");
    }

    const alerts = await getRiskAlerts(authUser);

    return <RiskCentrePage alerts={alerts} />;
  });
}