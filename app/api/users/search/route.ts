import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFreshAuthUser, hasRole } from "@/lib/authz";

// PRD PF06 — "Users and teams, for authorized managers." Agents don't get
// a people-search surface; Manager sees their own team, Admin sees everyone.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authUser = await getFreshAuthUser(session);
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
}
