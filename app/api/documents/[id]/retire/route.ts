import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthUser, hasRole } from "@/lib/authz";
import { logAudit } from "@/lib/auditLog";

// Doc: "An authorised content owner must be able to add, replace and
// retire documents." Retiring (no replacement document) just marks it
// inactive — it stops showing in the active list and Janus stops citing
// it, but the row (and file) stay for history, same governance level as
// delete (uploader, or Manager/Admin).
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = getAuthUser(session);

  const document = await prisma.document.findUnique({ where: { id: params.id } });
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }
  if (document.uploadedById !== authUser.id && !hasRole(authUser, ["MANAGER", "ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (document.status === "retired") {
    return NextResponse.json({ error: "Document is already retired" }, { status: 409 });
  }

  const updated = await prisma.document.update({
    where: { id: params.id },
    data: { status: "retired" },
  });

  await logAudit({
    actorId: authUser.id,
    actorEmail: session.user?.email ?? "unknown",
    action: "document_retired",
    targetId: document.id,
    details: `Retired "${document.name}"`,
  });

  return NextResponse.json(updated);
}
