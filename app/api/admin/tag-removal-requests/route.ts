import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/authz";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function GET() {
  try {
    return await withTenant(async (authUser) => {
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
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
