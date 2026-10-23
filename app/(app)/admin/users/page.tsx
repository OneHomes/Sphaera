import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withTenantPage } from "@/lib/withTenant";
import { AdminUsersPage } from "@/components/admin/AdminUsersPage";

export default async function AdminUsersRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async (authUser) => {
    if (authUser.role !== "ADMIN") {
      redirect("/dashboard");
    }

    return <AdminUsersPage canExportData={authUser.canExportData} />;
  });
}
