import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { uploadDocumentBlob } from "@/lib/blobStorage";
import { DOC_TYPES, type DocType } from "@/lib/documentsData";
import { logAudit } from "@/lib/auditLog";
import { extractDocumentText } from "@/lib/documentTextExtraction";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// PRD PF08 — Document and File Service. Documents are company-wide (like
// brochures/price lists shared across the team), not scoped to a single
// lead/user, matching the existing Document model (no Lead relation).

export async function GET() {
  try {
    return await withTenant(async () => {
      // Active only — Search and anywhere else fetching this list shouldn't
      // surface a retired/superseded version as if it were current.
      const documents = await prisma.document.findMany({
        where: { status: "active" },
        include: { uploadedBy: true },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(documents);
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

export async function POST(request: Request) {
  try {
    return await withTenant(async (_authUser, session) => {
      const user = await getOrCreateCurrentUser(session);

      const formData = await request.formData();
      const file = formData.get("file");
      const docType = formData.get("docType");
      const relatedTo = formData.get("relatedTo");

      if (!(file instanceof File)) {
        return NextResponse.json({ error: "file is required" }, { status: 400 });
      }
      if (typeof docType !== "string" || !DOC_TYPES.includes(docType as DocType)) {
        return NextResponse.json(
          { error: `docType must be one of: ${DOC_TYPES.join(", ")}` },
          { status: 400 }
        );
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

      const document = await prisma.document.create({
        data: {
          name: file.name,
          blobName,
          contentType: file.type || "application/octet-stream",
          sizeBytes: buffer.byteLength,
          docType: docType as DocType,
          relatedTo: typeof relatedTo === "string" && relatedTo.trim() ? relatedTo.trim() : null,
          uploadedById: user.id,
          extractedText,
        },
        include: { uploadedBy: true },
      });

      await logAudit({
        actorId: user.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "document_uploaded",
        targetId: document.id,
        details: `Uploaded "${document.name}" (${document.docType})`,
      });

      return NextResponse.json(document, { status: 201 });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
