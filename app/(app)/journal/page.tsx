import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { JournalPage as JournalPageComponent } from "@/components/journal/JournalPage";
import type { JournalNote, JournalFolder } from "@/lib/journalData";

export const dynamic = "force-dynamic";

export default async function JournalRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const user = await getOrCreateCurrentUser(session);

  const rows = await prisma.journalEntry.findMany({
    where: { authorId: user.id },
    orderBy: { updatedAt: "desc" },
  });

  const notes: JournalNote[] = rows.map((r) => ({
    id: r.id,
    folder: r.folder as JournalFolder,
    title: r.title,
    date: r.createdAt.toLocaleDateString([], {
      month: "short",
      day: "numeric",
    }),
    preview: r.body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 80),
    body: r.body,
    isFavorite: r.isFavorite,
    archivedAt: r.archivedAt?.toISOString() ?? null,
    deletedAt: r.deletedAt?.toISOString() ?? null,
    updatedAt: r.updatedAt.toISOString(),
  }));

  return <JournalPageComponent initialNotes={notes} />;
}