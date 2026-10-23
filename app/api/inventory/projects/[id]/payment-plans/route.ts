import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/authz";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    return await withTenant(async () => {
      const plans = await prisma.paymentPlan.findMany({
        where: { projectId: params.id },
        orderBy: { name: "asc" },
      });
      return NextResponse.json(plans);
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

// Phase 1 Sales Scope — "Allow CRO to create new payment plans."
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    return await withTenant(async (authUser, session) => {
      if (!hasRole(authUser, ["ADMIN"])) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const project = await prisma.project.findUnique({ where: { id: params.id } });
      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      const body = await request.json();
      if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
        return NextResponse.json({ error: "name is required" }, { status: 400 });
      }

      const plan = await prisma.paymentPlan.create({
        data: {
          projectId: project.id,
          name: body.name.trim(),
          description: typeof body.description === "string" ? body.description.trim() : null,
          createdById: authUser.id,
        },
      });

      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "inventory_payment_plan_created",
        targetId: plan.id,
        details: `Created payment plan "${plan.name}" for project "${project.name}"`,
      });

      return NextResponse.json(plan, { status: 201 });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
