import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFreshAuthUser, hasRole } from "@/lib/authz";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await getFreshAuthUser(session);
  if (!hasRole(authUser, ["ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const requests = await prisma.tagRemovalRequest.findMany({
    where: { status: "pending" },
    include: { leadTag: { include: { lead: { select: { id: true, name: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    requests.map((r) => ({
      id: r.id,
      tag: r.leadTag.tag,
      leadId: r.leadTag.lead.id,
      leadName: r.leadTag.lead.name,
      reason: r.reason,
      requestedByName: r.requestedByName,
      createdAt: r.createdAt,
    }))
  );
}
