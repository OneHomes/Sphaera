import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFreshAuthUser, hasRole } from "@/lib/authz";

// Phase 1 Sales Scope — "an authorised resolution process."
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await getFreshAuthUser(session);
  if (!hasRole(authUser, ["MANAGER", "ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const flags = await prisma.duplicateLeadFlag.findMany({
    where: { status: "pending" },
    include: {
      lead: { select: { id: true, name: true, contact: true, source: true, stage: true, createdAt: true } },
      duplicateOf: { select: { id: true, name: true, contact: true, source: true, stage: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(flags);
}
