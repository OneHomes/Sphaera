import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFreshAuthUser, hasRole } from "@/lib/authz";
import { logAudit } from "@/lib/auditLog";
import { toUiUnit, validateUnitCanBeAvailable, UNIT_STATUSES } from "@/lib/inventoryData";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const unit = await prisma.unit.findUnique({
    where: { id: params.id },
    include: { project: true, paymentPlan: true },
  });
  if (!unit) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }
  return NextResponse.json(toUiUnit(unit));
}

// Doc: "Retain an auditable history of inventory creation, commercial
// changes, document changes and status changes, including who made each
// change and when" — every branch below logs a real audit entry.
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

  const existing = await prisma.unit.findUnique({
    where: { id: params.id },
    include: { project: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Unit not found" }, { status: 404 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};
  const changes: string[] = [];

  if (body.status !== undefined) {
    if (!UNIT_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `status must be one of: ${UNIT_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    if (body.status === "available") {
      const reason = await validateUnitCanBeAvailable(params.id);
      if (reason) {
        return NextResponse.json({ error: reason }, { status: 409 });
      }
    }
    if (body.status !== existing.status) {
      data.status = body.status;
      changes.push(`status: ${existing.status} -> ${body.status}`);
    }
  }

  if (body.price !== undefined && Math.round(Number(body.price)) !== existing.price) {
    data.price = Math.round(Number(body.price));
    changes.push(`price: ${existing.price} -> ${data.price}`);
  }

  if (body.paymentPlanId !== undefined && body.paymentPlanId !== existing.paymentPlanId) {
    data.paymentPlanId = body.paymentPlanId || null;
    changes.push(`payment plan changed`);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(toUiUnit({ ...existing, paymentPlan: null }));
  }

  const updated = await prisma.unit.update({
    where: { id: params.id },
    data,
    include: { project: true, paymentPlan: true },
  });

  await logAudit({
    actorId: authUser.id,
    actorEmail: session.user?.email ?? "unknown",
    action: "inventory_unit_updated",
    targetId: updated.id,
    details: `${existing.project.name} ${existing.unitNumber}: ${changes.join("; ")}`,
  });

  return NextResponse.json(toUiUnit(updated));
}
