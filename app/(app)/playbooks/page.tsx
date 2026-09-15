import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { PlaybooksPage } from "@/components/playbooks/PlaybooksPage";

export const dynamic = "force-dynamic";

export default async function PlaybooksRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const user = await getOrCreateCurrentUser(session);

  const rows = await prisma.playbook.findMany({
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const playbooks = rows.map((p) => ({
    id: p.id,
    title: p.title,
    category: p.category,
    body: p.body,
    createdByName: p.createdBy.name,
    createdAt: p.createdAt.toLocaleDateString([], { month: "short", day: "numeric" }),
  }));

  return <PlaybooksPage initialPlaybooks={playbooks} canAuthor={user.role !== "AGENT"} />;
}
