import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthUser, hasRole } from "@/lib/authz";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { uploadDocumentBlob } from "@/lib/blobStorage";
import { extractDocumentText } from "@/lib/documentTextExtraction";
import { logAudit } from "@/lib/auditLog";

// Doc: "An authorised content owner must be able to add, replace and
// retire documents." Replacing creates a new version row (docType/
// relatedTo carried over from the version it replaces — it's the same
// document, just updated content) and retires the old one. Neither row
// is deleted: the version chain (supersedesId) IS the history.
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = getAuthUser(session);
  const user = await getOrCreateCurrentUser(session);

  const existing = await prisma.document.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (existing.uploadedById !== authUser.id && !hasRole(authUser, ["MANAGER", "ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (existing.status === "retired") {
    return NextResponse.json(
      { error: "Can't replace a retired document — it's already been superseded or retired" },
      { status: 409 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const blobName = `${randomUUID()}-${file.name}`;

  try {
    await uploadDocumentBlob(blobName, buffer, file.type || "application/octet-stream");
  } catch (err) {
    console.error("Blob upload failed:", err);
    return NextResponse.json(
      { error: "Failed to upload file to storage. Check Azure Storage configuration." },
      { status: 502 }
    );
  }

  const extractedText = await extractDocumentText(buffer, file.type || "");

  const [newVersion] = await prisma.$transaction([
    prisma.document.create({
      data: {
        name: file.name,
        blobName,
        contentType: file.type || "application/octet-stream",
        sizeBytes: buffer.byteLength,
        docType: existing.docType,
        relatedTo: existing.relatedTo,
        uploadedById: user.id,
        extractedText,
        version: existing.version + 1,
        supersedesId: existing.id,
      },
      include: { uploadedBy: true },
    }),
    prisma.document.update({
      where: { id: existing.id },
      data: { status: "retired" },
    }),
  ]);

  await logAudit({
    actorId: authUser.id,
    actorEmail: session.user?.email ?? "unknown",
    action: "document_replaced",
    targetId: newVersion.id,
    details: `Replaced "${existing.name}" (v${existing.version}) with "${newVersion.name}" (v${newVersion.version})`,
  });

  return NextResponse.json(newVersion, { status: 201 });
}
