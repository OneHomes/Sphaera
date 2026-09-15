import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/authz";
import { toUiDocument } from "@/lib/documentsData";
import { DocumentsPage as DocumentsPageComponent } from "@/components/documents/DocumentsPage";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }
  const authUser = getAuthUser(session);

  const rows = await prisma.document.findMany({
    include: { uploadedBy: true },
    orderBy: { createdAt: "desc" },
  });

  const documents = rows.map(toUiDocument);
  const documentOwnerIds = new Map(rows.map((r) => [r.id, r.uploadedById]));

  return (
    <DocumentsPageComponent
      initialDocuments={documents}
      documentOwnerIds={Object.fromEntries(documentOwnerIds)}
      currentUserId={authUser.id}
      canManageAll={authUser.role === "MANAGER" || authUser.role === "ADMIN"}
    />
  );
}
