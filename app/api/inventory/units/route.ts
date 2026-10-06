import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFreshAuthUser, hasRole } from "@/lib/authz";
import { logAudit } from "@/lib/auditLog";
import { toUiUnit } from "@/lib/inventoryData";

// PRD PF06-adjacent — every salesperson can browse inventory (Phase 1:
// "Browse inventory managed in Sphaera and use current unit details in
// the sales workflow"), only ADMIN (CRO proxy) can create/edit it.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const status = searchParams.get("status");

  const units = await prisma.unit.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      ...(status ? { status } : {}),
    },
    include: { project: true, paymentPlan: true },
    orderBy: [{ project: { name: "asc" } }, { unitNumber: "asc" }],
  });

  return NextResponse.json(units.map(toUiUnit));
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
  const required = ["projectId", "unitNumber", "unitType", "size", "price"];
  const missing = required.filter((f) => body[f] === undefined || body[f] === null || body[f] === "");
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required field(s): ${missing.join(", ")}` },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({ where: { id: body.projectId } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const existing = await prisma.unit.findFirst({
    where: { projectId: body.projectId, unitNumber: String(body.unitNumber) },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Unit ${body.unitNumber} already exists in ${project.name}` },
      { status: 409 }
    );
  }

  // Doc: "Required inventory fields: project, unit number, floor, unit
  // type, size and area basis, price, currency, availability, applicable
  // payment plan and mandatory floor plan." A brand-new unit starts
  // "blocked" — it can't become "available" until a floor plan is
  // attached (enforced in the status-change route, not just here).
  const unit = await prisma.unit.create({
    data: {
      projectId: body.projectId,
      unitNumber: String(body.unitNumber),
      floor: body.floor ? String(body.floor) : null,
      unitType: String(body.unitType),
      size: Number(body.size),
      areaBasis: body.areaBasis ? String(body.areaBasis) : "sqft",
      price: Math.round(Number(body.price)),
      currency: body.currency ? String(body.currency) : "AED",
      status: "blocked",
      paymentPlanId: body.paymentPlanId || null,
      createdById: authUser.id,
    },
    include: { project: true, paymentPlan: true },
  });

  await logAudit({
    actorId: authUser.id,
    actorEmail: session.user?.email ?? "unknown",
    action: "inventory_unit_created",
    targetId: unit.id,
    details: `Created unit ${unit.unitNumber} in "${project.name}"`,
  });

  return NextResponse.json(toUiUnit(unit), { status: 201 });
}
