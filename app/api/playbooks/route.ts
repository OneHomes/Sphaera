import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/authz";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// PRD AE18 — Playbook / best-practice feed. Read is open to everyone
// signed in (agents are the primary audience); authoring is
// Manager/Admin only, matching who curates best-practice content.
export async function GET() {
  try {
    return await withTenant(async () => {
      const playbooks = await prisma.playbook.findMany({
        include: { createdBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json(
        playbooks.map((p) => ({
          id: p.id,
          title: p.title,
          category: p.category,
          body: p.body,
          createdByName: p.createdBy.name,
          createdAt: p.createdAt.toISOString(),
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
      if (!hasRole(authUser, ["MANAGER", "ADMIN"])) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const body = await request.json();
      if (!body.title?.trim() || !body.category?.trim() || !body.body?.trim()) {
        return NextResponse.json(
          { error: "title, category, and body are required" },
          { status: 400 }
        );
      }

      const playbook = await prisma.playbook.create({
        data: {
          title: body.title.trim(),
          category: body.category.trim(),
          body: body.body.trim(),
          createdById: authUser.id,
        },
        include: { createdBy: { select: { name: true } } },
      });

      return NextResponse.json(
        {
          id: playbook.id,
          title: playbook.title,
          category: playbook.category,
          body: playbook.body,
          createdByName: playbook.createdBy.name,
          createdAt: playbook.createdAt.toISOString(),
        },
        { status: 201 }
      );
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
