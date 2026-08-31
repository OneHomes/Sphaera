import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthUser, hasRole } from "@/lib/authz";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { getVisibleTargets, TARGET_METRICS } from "@/lib/targetTracker";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getOrCreateCurrentUser(session);
  const targets = await getVisibleTargets(user.id, user.teamId);
  return NextResponse.json(targets);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authUser = getAuthUser(session);
  if (!hasRole(authUser, ["MANAGER", "ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const currentUser = await getOrCreateCurrentUser(session);
  const body = await request.json();
  const { userId, teamId, metric, periodStart, periodEnd, targetValue } = body;

  if (!metric || !TARGET_METRICS.some((m) => m.key === metric)) {
    return NextResponse.json({ error: "Invalid metric" }, { status: 400 });
  }
  if (!periodStart || !periodEnd || !targetValue) {
    return NextResponse.json(
      { error: "periodStart, periodEnd, and targetValue are required" },
      { status: 400 }
    );
  }
  if (!userId && !teamId) {
    return NextResponse.json(
      { error: "Either userId or teamId is required" },
      { status: 400 }
    );
  }

  // A Manager may only set targets for themselves or their own team;
  // Admin can set targets for anyone/any team.
  if (authUser.role === "MANAGER") {
    if (teamId && teamId !== authUser.teamId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (userId) {
      const targetUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!targetUser || targetUser.teamId !== authUser.teamId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  const target = await (prisma as any).target.create({
    data: {
      userId: userId || null,
      teamId: teamId || null,
      metric,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      targetValue: Number(targetValue),
      createdById: currentUser.id,
    },
  });

  return NextResponse.json(target, { status: 201 });
}