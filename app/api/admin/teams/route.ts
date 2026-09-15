import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFreshAuthUser, hasRole } from "@/lib/authz";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await getFreshAuthUser(session);

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
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await getFreshAuthUser(session);

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
}