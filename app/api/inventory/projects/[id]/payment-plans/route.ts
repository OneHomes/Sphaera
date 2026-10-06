import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFreshAuthUser, hasRole } from "@/lib/authz";
import { logAudit } from "@/lib/auditLog";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plans = await prisma.paymentPlan.findMany({
    where: { projectId: params.id },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(plans);
}

// Phase 1 Sales Scope — "Allow CRO to create new payment plans."
export async function POST(
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
}
