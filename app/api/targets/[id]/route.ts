import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/authz";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { getVisibleTargets, TARGET_METRICS } from "@/lib/targetTracker";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function GET() {
  try {
    return await withTenant(async (authUser, session) => {
      const user = await getOrCreateCurrentUser(session);
      const targets = await getVisibleTargets(user.id, user.teamId);
      return NextResponse.json(targets);
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
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
    }, { fresh: false });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
