import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tierForPoints } from "@/lib/aexTransform";
import { getAexConfig } from "@/lib/aexConfig";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function GET() {
  try {
    return await withTenant(async () => {
      const [users, aexConfig] = await Promise.all([
        prisma.user.findMany({
          include: {
            pointEvents: { select: { points: true } },
          },
        }),
        getAexConfig(),
      ]);

      const ranked = users
        .map((u) => {
          const points = u.pointEvents.reduce((sum, e) => sum + e.points, 0);
          return {
            id: u.id,
            name: u.name,
            tier: tierForPoints(points, aexConfig.tierThresholds),
            points,
          };
        })
        .sort((a, b) => b.points - a.points)
        .map((row, i) => ({ ...row, rank: i + 1 }));

      return NextResponse.json(ranked);
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
