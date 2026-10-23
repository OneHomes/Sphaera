import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/authz";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// PRD PF06 — "Users and teams, for authorized managers." Agents don't get
// a people-search surface; Manager sees their own team, Admin sees everyone.
export async function GET(request: Request) {
  try {
    return await withTenant(async (authUser) => {
      if (!hasRole(authUser, ["MANAGER", "ADMIN"])) {
        return NextResponse.json([], { status: 200 });
      }

      const { searchParams } = new URL(request.url);
      const search = searchParams.get("search");
      if (!search) {
        return NextResponse.json([]);
      }

      const users = await prisma.user.findMany({
        where: {
          AND: [
            authUser.role === "MANAGER" && authUser.teamId
              ? { teamId: authUser.teamId }
              : {},
            { name: { contains: search } },
          ],
        },
        select: { id: true, name: true, role: true, teamId: true },
        take: 10,
      });

      return NextResponse.json(users);
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
