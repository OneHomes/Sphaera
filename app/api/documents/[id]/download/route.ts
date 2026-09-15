import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDocumentDownloadUrl } from "@/lib/blobStorage";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
}
