import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/authz";
import { deleteDocumentBlob } from "@/lib/blobStorage";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    return await withTenant(async (authUser, session) => {
      const document = await prisma.document.findUnique({ where: { id: params.id } });
      if (!document) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }

      // Uploader, or Manager/Admin, may delete — same governance level as
      // most other record deletions in this build.
      if (document.uploadedById !== authUser.id && !hasRole(authUser, ["MANAGER", "ADMIN"])) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      try {
        await deleteDocumentBlob(document.blobName);
      } catch (err) {
        console.error("Blob delete failed:", err);
        // Continue anyway — an orphaned blob is a cheaper problem than a
        // document record the user can't get rid of.
      }

      await prisma.document.delete({ where: { id: params.id } });

      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "document_deleted",
        targetId: params.id,
        details: `Deleted "${document.name}"`,
      });

      return NextResponse.json({ success: true });
    }, { fresh: false });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
