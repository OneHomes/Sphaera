import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/authz";
import { CLOSED_OPPORTUNITY_STAGES } from "@/lib/allocationRules";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function GET() {
  try {
    return await withTenant(async (authUser) => {
      if (!hasRole(authUser, ["ADMIN"])) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const users = await prisma.user.findMany({
        orderBy: { createdAt: "asc" },
        include: {
          team: true,
          _count: {
            select: { assignedLeads: true },
          },
        },
      });

      // Active opportunity count needs a stage filter, so it's queried
      // separately per user rather than via the generic _count above.
      // Fairness visibility (PRD R08) — lets an admin spot at-a-glance
      // whether allocation is lopsided across the team.
      const activeOpportunityCounts = await prisma.opportunity.groupBy({
        by: ["assignedUserId"],
        where: {
          assignedUserId: { not: null },
          stage: { notIn: CLOSED_OPPORTUNITY_STAGES },
        },
        _count: true,
      });
      const oppCountByUser = new Map(
        activeOpportunityCounts.map((row) => [row.assignedUserId, row._count])
      );

      return NextResponse.json(
        users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          teamId: u.teamId,
          teamName: u.team?.name ?? null,
          canExportData: u.canExportData,
          createdAt: u.createdAt.toISOString(),
          activeLeadCount: u._count.assignedLeads,
          activeOpportunityCount: oppCountByUser.get(u.id) ?? 0,
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
