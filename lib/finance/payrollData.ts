import { prisma } from "@/lib/prisma";
import { sortDepartments } from "@/lib/finance/ledgerData";
import {
  buildExceptions,
  componentSum,
  usdEquivalent,
  variance,
  type PayrollLine,
  type PayrollParse,
  type SourceTotal,
} from "@/lib/finance/payrollImport";

// Payroll master runs (People Costs skill). These are HR reference records used to reconcile against
// person allocations on real ledger payments. Nothing here ever creates a FinanceTransaction.

export async function getDepartmentCatalogue(): Promise<string[]> {
  const rows = await prisma.financeManagementDepartment.findMany({ select: { name: true } });
  return sortDepartments(rows.map((r) => r.name));
}

const toLine = (l: {
  csvRow: number;
  employeeName: string;
  sourceDepartment: string | null;
  approvedDepartment: string | null;
  subDepartment: string | null;
  designation: string | null;
  company: string | null;
  dateJoined: Date | null;
  employmentType: string | null;
  employmentStatus: string | null;
  currency: string;
  baseSalary: number;
  transportAllowance: number;
  bookingsCommission: number;
  dealClosedCommission: number;
  sourcePayable: number;
  sourceComments: string | null;
  reviewNote: string | null;
}): PayrollLine => ({
  ...l,
  currency: l.currency === "PKR" ? "PKR" : "USD",
  dateJoined: l.dateJoined ? l.dateJoined.toISOString().slice(0, 10) : null,
});

export async function savePayrollRun(p: PayrollParse, createdBy: string) {
  const exceptions = buildExceptions(p);
  return prisma.financePayrollRun.create({
    data: {
      sourceName: p.sourceName,
      payPeriod: p.payPeriod,
      fxPkrPerUsd: p.fxPkrPerUsd,
      employeeCount: p.lines.length,
      status: "Draft",
      sourceTotalsJson: JSON.stringify(p.sourceTotals),
      exceptionsJson: JSON.stringify(exceptions),
      createdBy,
      lines: {
        create: p.lines.map((l) => ({
          csvRow: l.csvRow,
          employeeName: l.employeeName,
          sourceDepartment: l.sourceDepartment,
          approvedDepartment: l.approvedDepartment,
          subDepartment: l.subDepartment,
          designation: l.designation,
          company: l.company,
          dateJoined: l.dateJoined ? new Date(l.dateJoined) : null,
          employmentType: l.employmentType,
          employmentStatus: l.employmentStatus,
          currency: l.currency,
          baseSalary: l.baseSalary,
          transportAllowance: l.transportAllowance,
          bookingsCommission: l.bookingsCommission,
          dealClosedCommission: l.dealClosedCommission,
          sourcePayable: l.sourcePayable,
          sourceComments: l.sourceComments,
          reviewNote: l.reviewNote,
        })),
      },
    },
    select: { id: true },
  });
}

export async function listPayrollRuns() {
  return prisma.financePayrollRun.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, sourceName: true, payPeriod: true, status: true, employeeCount: true, fxPkrPerUsd: true, createdAt: true, createdBy: true, approvedAt: true, approvedBy: true },
  });
}

export type PayrollRunDetail = NonNullable<Awaited<ReturnType<typeof getPayrollRun>>>;

/** Full run with lines, live exceptions and the ledger reconciliation for its pay period. */
export async function getPayrollRun(id: string) {
  const run = await prisma.financePayrollRun.findFirst({ where: { id }, include: { lines: { orderBy: { csvRow: "asc" } } } });
  if (!run) return null;
  const lines = run.lines.map((l) => ({ id: l.id, personId: l.personId, ...toLine(l) }));
  const sourceTotals = JSON.parse(run.sourceTotalsJson) as SourceTotal[];
  const parse: PayrollParse = { sourceName: run.sourceName, payPeriod: run.payPeriod, fxPkrPerUsd: run.fxPkrPerUsd, fxFromSource: true, lines, sourceTotals, departments: [] };
  const exceptions = buildExceptions(parse);
  const reconciliation = await reconcile(run.payPeriod, lines, run.fxPkrPerUsd);
  return {
    id: run.id,
    sourceName: run.sourceName,
    payPeriod: run.payPeriod,
    fxPkrPerUsd: run.fxPkrPerUsd,
    status: run.status,
    createdAt: run.createdAt,
    createdBy: run.createdBy,
    approvedAt: run.approvedAt,
    approvedBy: run.approvedBy,
    lines: lines.map((l) => ({ ...l, componentSum: componentSum(l), variance: variance(l), usdEquivalent: usdEquivalent(l, run.fxPkrPerUsd) })),
    sourceTotals,
    exceptions,
    reconciliation,
  };
}

export type ReconciliationRow = {
  employeeName: string;
  personId: string | null;
  department: string | null;
  masterUsdEquivalent: number;
  attributedUsd: number;
  difference: number;
  status: "Matched" | "Under-attributed" | "Over-attributed" | "No ledger attribution" | "Not linked";
};

/**
 * Payroll master vs attributed spend: master USD equivalent per employee against the person
 * allocations on ledger payments in the same month. The master is a claim, the allocations are spend.
 */
async function reconcile(payPeriod: string | null, lines: (PayrollLine & { personId: string | null })[], fx: number) {
  if (!payPeriod) return null;
  const allocs = await prisma.financePersonCostAllocation.findMany({
    where: { transaction: { month: payPeriod } },
    select: { personId: true, amountUsd: true, person: { select: { fullName: true } } },
  });
  const byPerson = new Map<string, number>();
  for (const a of allocs) byPerson.set(a.personId, (byPerson.get(a.personId) ?? 0) + a.amountUsd);
  const linked = new Set<string>();
  const rows: ReconciliationRow[] = lines.map((l) => {
    const master = usdEquivalent(l, fx);
    if (!l.personId) {
      return { employeeName: l.employeeName, personId: null, department: l.approvedDepartment, masterUsdEquivalent: master, attributedUsd: 0, difference: -master, status: "Not linked" };
    }
    linked.add(l.personId);
    const attributed = byPerson.get(l.personId) ?? 0;
    const difference = Math.round((attributed - master) * 100) / 100;
    const status: ReconciliationRow["status"] =
      attributed === 0 ? "No ledger attribution" : Math.abs(difference) <= 1 ? "Matched" : difference < 0 ? "Under-attributed" : "Over-attributed";
    return { employeeName: l.employeeName, personId: l.personId, department: l.approvedDepartment, masterUsdEquivalent: master, attributedUsd: attributed, difference, status };
  });
  // Allocations to people who are not on this payroll master at all.
  const extra = new Map<string, { name: string; usd: number }>();
  for (const a of allocs) {
    if (linked.has(a.personId)) continue;
    const e = extra.get(a.personId) ?? { name: a.person.fullName, usd: 0 };
    e.usd += a.amountUsd;
    extra.set(a.personId, e);
  }
  return {
    month: payPeriod,
    rows,
    notOnMaster: [...extra.entries()].map(([personId, e]) => ({ personId, employeeName: e.name, attributedUsd: e.usd })),
    totals: {
      masterUsdEquivalent: rows.reduce((s, r) => s + r.masterUsdEquivalent, 0),
      attributedUsd: allocs.reduce((s, a) => s + a.amountUsd, 0),
    },
  };
}

export class PayrollRuleError extends Error {}

async function draftRun(id: string) {
  const run = await prisma.financePayrollRun.findFirst({ where: { id }, select: { id: true, status: true } });
  if (!run) throw new PayrollRuleError("Payroll run not found.");
  if (run.status !== "Draft") throw new PayrollRuleError("Approved payroll runs are locked.");
  return run;
}

/** Draft edits: pay period and per-line approved department / review note. Payable amounts are never editable. */
export async function updateDraftRun(
  id: string,
  patch: { payPeriod?: string | null; lines?: { id: string; approvedDepartment?: string | null; reviewNote?: string | null }[] },
) {
  await draftRun(id);
  const catalogue = await getDepartmentCatalogue();
  if (patch.payPeriod !== undefined && patch.payPeriod !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(patch.payPeriod)) {
    throw new PayrollRuleError("Pay period must be YYYY-MM.");
  }
  for (const l of patch.lines ?? []) {
    if (l.approvedDepartment && !catalogue.includes(l.approvedDepartment)) {
      throw new PayrollRuleError(`"${l.approvedDepartment}" is not an approved Sphaera department.`);
    }
  }
  await prisma.$transaction([
    ...(patch.payPeriod !== undefined ? [prisma.financePayrollRun.update({ where: { id }, data: { payPeriod: patch.payPeriod } })] : []),
    ...(patch.lines ?? []).map((l) =>
      prisma.financePayrollLine.updateMany({
        where: { id: l.id, runId: id },
        data: {
          ...(l.approvedDepartment !== undefined ? { approvedDepartment: l.approvedDepartment || null } : {}),
          ...(l.reviewNote !== undefined ? { reviewNote: l.reviewNote?.trim() || null } : {}),
        },
      }),
    ),
  ]);
}

/**
 * Approval: pay period confirmed, every row has an approved department, and every payable/component
 * variance carries a Finance review note. Each employee is linked to (or registered as) a FinancePerson.
 */
export async function approveRun(id: string, approvedBy: string) {
  await draftRun(id);
  const run = await prisma.financePayrollRun.findFirstOrThrow({ where: { id }, include: { lines: true } });
  if (!run.payPeriod) throw new PayrollRuleError("Confirm the pay period before approving.");
  const clash = await prisma.financePayrollRun.findFirst({ where: { status: "Approved", payPeriod: run.payPeriod }, select: { id: true } });
  if (clash) throw new PayrollRuleError(`An approved payroll run already exists for ${run.payPeriod}.`);
  const unmapped = run.lines.filter((l) => !l.approvedDepartment);
  if (unmapped.length) throw new PayrollRuleError(`${unmapped.length} employee row(s) still need an approved department.`);
  const unexplained = run.lines.filter((l) => Math.abs(variance(toLine(l))) > 0.009 && !l.reviewNote);
  if (unexplained.length) {
    throw new PayrollRuleError(`${unexplained.length} pay discrepancy row(s) need a Finance review note: ${unexplained.map((l) => l.employeeName).join(", ")}.`);
  }

  const people = await prisma.financePerson.findMany({ select: { id: true, fullName: true, department: true } });
  const byName = new Map(people.map((p) => [p.fullName.trim().toLowerCase(), p]));
  await prisma.$transaction(async (tx) => {
    for (const l of run.lines) {
      const key = l.employeeName.trim().toLowerCase();
      let person = byName.get(key);
      if (!person) {
        person = await tx.financePerson.create({ data: { organizationId: run.organizationId, fullName: l.employeeName.trim(), department: l.approvedDepartment }, select: { id: true, fullName: true, department: true } });
        byName.set(key, person);
      } else if (person.department !== l.approvedDepartment) {
        // Existing allocations keep their departmentSnapshot; only future allocations pick this up.
        await tx.financePerson.update({ where: { id: person.id }, data: { department: l.approvedDepartment } });
      }
      await tx.financePayrollLine.update({ where: { id: l.id }, data: { personId: person.id } });
    }
    await tx.financePayrollRun.update({ where: { id }, data: { status: "Approved", approvedBy, approvedAt: new Date() } });
  });
  return { linked: run.lines.length };
}

export async function deleteDraftRun(id: string) {
  await draftRun(id);
  await prisma.financePayrollRun.delete({ where: { id } });
}
