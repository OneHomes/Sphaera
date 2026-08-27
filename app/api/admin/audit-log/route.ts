import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthUser, hasRole } from "@/lib/authz";

// PF07 (Audit Trail) + PRD Section 14.12 ("the governance report must
// show suspicious patterns, rule versions, and manual adjustments") —
// this is the read surface for the AuditLog table, showing both RBAC
// role/team changes and AEX anti-gaming rejections.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = getAuthUser(session);

  if (!hasRole(authUser, ["ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(
    entries.map((e) => ({
      id: e.id,
      actorEmail: e.actorEmail,
      action: e.action,
      details: e.details,
      createdAt: e.createdAt.toISOString(),
    }))
  );
}