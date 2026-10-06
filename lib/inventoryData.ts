import type { Unit as PrismaUnit, Project as PrismaProject, PaymentPlan as PrismaPaymentPlan } from "@prisma/client";
import { prisma } from "./prisma";

export const UNIT_STATUSES = ["available", "reserved", "sold", "blocked"] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];

export type UiUnit = {
  id: string;
  projectId: string;
  projectName: string;
  unitNumber: string;
  floor: string | null;
  unitType: string;
  size: number;
  areaBasis: string;
  price: number;
  currency: string;
  status: UnitStatus;
  paymentPlanName: string | null;
  hasFloorPlan: boolean;
  hasViews: boolean;
};

export function toUiUnit(
  row: PrismaUnit & { project: PrismaProject; paymentPlan: PrismaPaymentPlan | null }
): UiUnit {
  return {
    id: row.id,
    projectId: row.projectId,
    projectName: row.project.name,
    unitNumber: row.unitNumber,
    floor: row.floor,
    unitType: row.unitType,
    size: row.size,
    areaBasis: row.areaBasis,
    price: row.price,
    currency: row.currency,
    status: row.status as UnitStatus,
    paymentPlanName: row.paymentPlan?.name ?? null,
    hasFloorPlan: Boolean(row.floorPlanDocId),
    hasViews: Boolean(row.viewsDocId),
  };
}

/**
 * Phase 1 Sales Scope rules, enforced here (not just the UI) since a
 * proposal must never be able to present a unit that doesn't actually
 * qualify:
 *   1. A unit can't be "available" without a floor plan.
 *   2. If ANY unit in a project has views uploaded, every other unit in
 *      that same project must also have views before it can be
 *      "available" — a project-wide rule, not per-unit.
 * Returns null if the unit may become available, or a human-readable
 * reason why not.
 */
export async function validateUnitCanBeAvailable(
  unitId: string
): Promise<string | null> {
  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) return "Unit not found";

  if (!unit.floorPlanDocId) {
    return "A floor plan is mandatory before this unit can be made available.";
  }

  const projectHasAnyViews = await prisma.unit.findFirst({
    where: { projectId: unit.projectId, viewsDocId: { not: null } },
    select: { id: true },
  });

  if (projectHasAnyViews && !unit.viewsDocId) {
    return "Another unit in this project has views uploaded, which makes views mandatory for every unit in the project — upload views for this unit first.";
  }

  return null;
}

/**
 * A unit already sold or otherwise unavailable must not be presented as
 * available (Phase 1 doc, acceptance check) — the one check every
 * proposal/booking flow must call before quoting a unit to a client.
 */
export async function assertUnitIsAvailable(unitId: string): Promise<UiUnit> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    include: { project: true, paymentPlan: true },
  });
  if (!unit) throw new Error("Unit not found");
  if (unit.status !== "available") {
    throw new Error(
      `${unit.project.name} ${unit.unitNumber} is currently "${unit.status}" and cannot be proposed.`
    );
  }
  return toUiUnit(unit);
}
