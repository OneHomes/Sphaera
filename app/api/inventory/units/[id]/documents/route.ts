import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFreshAuthUser, hasRole } from "@/lib/authz";
import { uploadDocumentBlob } from "@/lib/blobStorage";
import { logAudit } from "@/lib/auditLog";
import { toUiUnit } from "@/lib/inventoryData";

// Doc: "Allow the Chief Revenue Officer to upload and maintain the
// mandatory floor plan and optional views against the relevant unit or
// project." Reuses the existing PF08 Document/Blob Storage service —
// kind is either "floorPlan" or "views", linking the resulting Document
// row to the Unit via floorPlanDocId/viewsDocId.
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await getFreshAuthUser(session);
  if (!hasRole(authUser, ["ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const unit = await prisma.unit.findUnique({
    where: { id: params.id },
    include: { project: true },
  });
  if (!unit) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = formData.get("kind");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }
  if (kind !== "floorPlan" && kind !== "views") {
    return NextResponse.json({ error: "kind must be 'floorPlan' or 'views'" }, { status: 400 });
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

  const document = await prisma.document.create({
    data: {
      name: file.name,
      blobName,
      contentType: file.type || "application/octet-stream",
      sizeBytes: buffer.byteLength,
      docType: kind === "floorPlan" ? "Floor Plan" : "Unit View",
      relatedTo: `${unit.project.name} ${unit.unitNumber}`,
      uploadedById: authUser.id,
    },
  });

  const updated = await prisma.unit.update({
    where: { id: unit.id },
    data: kind === "floorPlan" ? { floorPlanDocId: document.id } : { viewsDocId: document.id },
    include: { project: true, paymentPlan: true },
  });

  await logAudit({
    actorId: authUser.id,
    actorEmail: session.user?.email ?? "unknown",
    action: "inventory_document_uploaded",
    targetId: unit.id,
    details: `Uploaded ${kind === "floorPlan" ? "floor plan" : "views"} for ${unit.project.name} ${unit.unitNumber}`,
  });

  return NextResponse.json(toUiUnit(updated), { status: 201 });
}
