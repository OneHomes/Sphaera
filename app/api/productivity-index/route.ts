import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAccessRecord } from "@/lib/authz";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { calculateProductivityIndex } from "@/lib/productivityIndex";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function GET(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      const currentUser = await getOrCreateCurrentUser(session);
      const { searchParams } = new URL(request.url);
      const requestedUserId = searchParams.get("userId");

      let targetUserId = currentUser.id;

      if (requestedUserId && requestedUserId !== currentUser.id) {
        // Only Admin, or a Manager viewing someone on their own team, may
        // view another user's Productivity Index.
        const targetUser = await prisma.user.findUnique({
          where: { id: requestedUserId },
        });
        if (!targetUser) {
          return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        if (!canAccessRecord(authUser, targetUser.id, targetUser.teamId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        targetUserId = targetUser.id;
      }

      const result = await calculateProductivityIndex(targetUserId);
      return NextResponse.json(result);
    }, { fresh: false });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
