import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/authz";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function GET() {
  try {
    return await withTenant(async () => {
      const projects = await prisma.project.findMany({
        include: { _count: { select: { units: true } } },
        orderBy: { name: "asc" },
      });

      return NextResponse.json(
        projects.map((p) => ({ id: p.id, name: p.name, unitCount: p._count.units }))
      );
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

// Phase 1 Sales Scope — "The Chief Revenue Officer must be able to
// create and maintain project inventory directly in Sphaera." Sphaera's
// role model has no dedicated CRO tier yet, so this is gated to ADMIN as
// the closest existing proxy — a known placeholder pending a real
// business decision on roles (same note as schema.prisma).
export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!hasRole(authUser, ["ADMIN"])) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const body = await request.json();
      if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
        return NextResponse.json({ error: "name is required" }, { status: 400 });
      }

      const project = await prisma.project.create({
        data: { name: body.name.trim(), createdById: authUser.id },
      });

      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "inventory_project_created",
        targetId: project.id,
        details: `Created project "${project.name}"`,
      });

      return NextResponse.json(project, { status: 201 });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
