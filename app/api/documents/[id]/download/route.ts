import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDocumentDownloadUrl } from "@/lib/blobStorage";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    return await withTenant(async () => {
      const document = await prisma.document.findUnique({ where: { id: params.id } });
      if (!document) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }

      try {
        const url = await getDocumentDownloadUrl(document.blobName);
        return NextResponse.redirect(url);
      } catch (err) {
        console.error("SAS URL generation failed:", err);
        return NextResponse.json(
          { error: "Couldn't generate a download link. Check Azure Storage configuration." },
          { status: 502 }
        );
      }
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
