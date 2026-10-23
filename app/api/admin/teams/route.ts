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

      const teams = await prisma.team.findMany({
        orderBy: { name: "asc" },
        include: { manager: true, members: true },
      });

      return NextResponse.json(
        teams.map((t) => ({
          id: t.id,
          name: t.name,
          managerName: t.manager?.name ?? null,
          memberCount: t.members.length,
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

export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser) => {
      if (!hasRole(authUser, ["ADMIN"])) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const body = await request.json();
      if (!body.name || !body.name.trim()) {
        return NextResponse.json(
          { error: "Team name is required" },
          { status: 400 }
        );
      }

      const team = await prisma.team.create({
        data: { name: body.name.trim() },
      });

      return NextResponse.json(team, { status: 201 });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
