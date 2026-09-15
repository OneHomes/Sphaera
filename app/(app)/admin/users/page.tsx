import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFreshAuthUser } from "@/lib/authz";
import { AdminUsersPage } from "@/components/admin/AdminUsersPage";

export default async function AdminUsersRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const authUser = await getFreshAuthUser(session);
  if (authUser.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return <AdminUsersPage />;
}