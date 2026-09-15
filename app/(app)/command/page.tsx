import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { CommandCenter } from "@/components/janus/CommandCenter";

export default async function CommandPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const user = await getOrCreateCurrentUser(session);

  return <CommandCenter isManagementView={user.role === "ADMIN" || user.role === "MANAGER"} />;
}
