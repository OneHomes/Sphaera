import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tierForPoints } from "@/lib/aexTransform";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    include: {
      pointEvents: { select: { points: true } },
    },
  });

  const ranked = users
    .map((u) => {
      const points = u.pointEvents.reduce((sum, e) => sum + e.points, 0);
      return {
        id: u.id,
        name: u.name,
        tier: tierForPoints(points),
        points,
      };
    })
    .sort((a, b) => b.points - a.points)
    .map((row, i) => ({ ...row, rank: i + 1 }));

  return NextResponse.json(ranked);
}