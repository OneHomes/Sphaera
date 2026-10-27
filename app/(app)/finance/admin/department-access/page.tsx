import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { DepartmentAccessPage } from "@/components/finance/DepartmentAccessPage";

export const dynamic = "force-dynamic";

export default async function FinanceDepartmentAccessRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async (authUser) => {
    if (authUser.role !== "ADMIN") {
      redirect("/finance");
    }
    return <DepartmentAccessPage />;
  });
}
