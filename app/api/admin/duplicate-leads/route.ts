import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/authz";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// Phase 1 Sales Scope — "an authorised resolution process."
export async function GET() {
  try {
    return await withTenant(async (authUser) => {
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
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
