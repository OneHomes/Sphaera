import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { hasRole } from "@/lib/authz";
import { LiveCalls } from "@/components/video/LiveCalls";

export const dynamic = "force-dynamic";

// Admin only: live video calls and the unseen monitor.
export default async function LiveCallsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/sign-in");

  return withTenantPage(session, async (authUser) => {
    if (!hasRole(authUser, ["ADMIN"])) redirect("/dashboard");
    return <LiveCalls />;
  });
}
