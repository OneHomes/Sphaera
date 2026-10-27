import type { FinanceLedgerRow, FinanceState } from "./ledgerData";
import { fyOf, type FinanceFilters } from "./financeFilters";

// Client-safe ports of the source app's shared reporting helpers (index.html):
// effectiveHead/effectiveCentre/operating/unidentified/reportingRows/
// relevantMonths/monthlyNumbers/budgetOk. Type-only imports from ledgerData.

export const effectiveHead = (t: FinanceLedgerRow) => t.managementDepartment || "Unallocated";
export const effectiveCentre = (t: FinanceLedgerRow) => t.managementCostHead || "Needs allocation";
export const isUnidentified = (t: FinanceLedgerRow) => !t.managementDepartment || !t.managementCostHead;
export const hasCostSplit = (t: FinanceLedgerRow) => Array.isArray(t.departmentSplits) && t.departmentSplits.length > 0;

export function isOperating(t: FinanceLedgerRow, departments: string[]): boolean {
  return departments.includes(effectiveHead(t)) && t.debtPeriod === "current";
}

export function sum(rows: FinanceLedgerRow[]): number {
  return rows.reduce((s, t) => s + t.amount, 0);
}

/** Approved cost splits are reported as department slices; other rows pass through when they match the department filter. */
export function reportingRows<T extends FinanceLedgerRow>(tx: T[], department: string): T[] {
  const rows: T[] = [];
  for (const t of tx) {
    if (hasCostSplit(t) && t.debtPeriod === "current") {
      for (const x of t.departmentSplits) {
        if (department !== "all" && x.department !== department) continue;
        rows.push({ ...t, amount: Number(x.amountUsd), managementDepartment: x.department, managementCostHead: x.costHead });
      }
    } else if (department === "all" || effectiveHead(t) === department) {
      rows.push(t);
    }
  }
  return rows;
}

function activePlan(state: FinanceState, fy: number) {
  return state.approvedPlans.find((p) => p.fyStart === fy) ?? null;
}

export function relevantMonths(state: FinanceState, filters: FinanceFilters): string[] {
  const planned = filters.fy === "all" ? [] : activePlan(state, Number(filters.fy))?.lines.map((l) => l.month) ?? [];
  const all = new Set([...state.monthly.map((m) => m.month), ...state.transactions.map((t) => t.month), ...planned]);
  return Array.from(all)
    .sort()
    .filter(
      (m) =>
        (filters.fy === "all" || fyOf(m) === Number(filters.fy)) &&
        (filters.start === "all" || m >= filters.start) &&
        (filters.end === "all" || m <= filters.end)
    );
}

export type MonthNumbers = {
  month: string;
  ledger: number;
  opex: number;
  debt: number;
  collections: number | null;
  budget: number | null;
  variance: number | null;
  awaitingActuals: boolean;
  unidentified: number;
};

/** `tx` is the already-filtered transaction list; `state` is the unfiltered state (actuals/monthly/plans are global lookups). */
export function monthlyNumbers(tx: FinanceLedgerRow[], month: string, state: FinanceState, filters: FinanceFilters): MonthNumbers {
  const matching = tx.filter((x) => x.month === month);
  const opexRows = reportingRows(matching, filters.department).filter((t) => isOperating(t, state.departments));
  const debtRows = matching.filter((x) => x.debtPeriod !== "current");
  const m = state.monthly.find((z) => z.month === month);
  const plan = activePlan(state, fyOf(month));
  const lines = plan ? plan.lines.filter((l) => l.month === month && (filters.department === "all" || l.department === filters.department)) : [];
  const budget =
    filters.country !== "all" || filters.query.trim()
      ? null
      : plan
        ? lines.reduce((s, l) => s + l.budgetUsd, 0)
        : filters.department === "all"
          ? m && m.opexBudget > 0
            ? m.opexBudget
            : null
          : null;
  const hasActual = state.transactions.some((x) => x.month === month);
  const opex = sum(opexRows);
  return {
    month,
    ledger: sum(matching),
    opex,
    debt: sum(debtRows),
    collections: m ? m.collections : null,
    budget,
    variance: budget === null || !hasActual ? null : opex - budget,
    awaitingActuals: !hasActual,
    unidentified: sum(matching.filter(isUnidentified)),
  };
}

export function budgetOk(state: FinanceState, filters: FinanceFilters): boolean {
  return (
    filters.department === "all" &&
    filters.country === "all" &&
    !filters.query.trim() &&
    !state.transactions.some(isUnidentified)
  );
}

export function mo(month: string): string {
  if (!month) return "";
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}
