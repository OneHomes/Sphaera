import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFreshAuthUser, hasRole } from "@/lib/authz";
import { ROLES, type Role } from "@/lib/roles";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = await getFreshAuthUser(session);

  if (!hasRole(authUser, ["ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const existing = await prisma.user.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const data: { role?: Role; teamId?: string | null } = {};

  if ("role" in body) {
    if (!ROLES.includes(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    data.role = body.role;
  }

  if ("teamId" in body) {
    data.teamId = body.teamId || null;
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data,
  });

  const changeDescriptions: string[] = [];
  if (data.role && data.role !== existing.role) {
    changeDescriptions.push(`role: ${existing.role} -> ${data.role}`);
  }
  if ("teamId" in data && data.teamId !== existing.teamId) {
    changeDescriptions.push(`team: ${existing.teamId ?? "none"} -> ${data.teamId ?? "none"}`);
  }

  if (changeDescriptions.length > 0) {
    await prisma.auditLog.create({
      data: {
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "user_role_or_team_change",
        targetId: params.id,
        details: `Changed for ${existing.email}: ${changeDescriptions.join(", ")}`,
      },
    });
  }

  return NextResponse.json({
    id: updated.id,
    role: updated.role,
    teamId: updated.teamId,
  });
}