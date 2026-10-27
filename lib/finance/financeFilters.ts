import type { FinanceLedgerRow } from "./ledgerData";

// Duplicated from ledgerData.ts rather than imported — that module has a
// module-scope `import { prisma } from "../prisma"`, which pulls Node's
// `async_hooks` into the client bundle of any "use client" component that
// transitively imports this file (the Finance filter bar is one). Same
// client/server bundle-leakage fix pattern used elsewhere in this port.
export function fyOf(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return m >= 11 ? y : y - 1;
}

// Direct equivalent of the source app's global filter bar (renderTop() +
// filt()) — Financial year / From month / To month / Department / Country
// / Search payments, applied client-side across every Finance screen.
// "all" means unrestricted for every field except `query`, which is "" when
// empty.
export type FinanceFilters = {
  fy: string;
  start: string;
  end: string;
  department: string;
  country: string;
  query: string;
};

export const DEFAULT_FINANCE_FILTERS: FinanceFilters = {
  fy: "all",
  start: "all",
  end: "all",
  department: "all",
  country: "all",
  query: "",
};

export function isFinanceFiltersActive(filters: FinanceFilters): boolean {
  return (
    filters.fy !== "all" ||
    filters.start !== "all" ||
    filters.end !== "all" ||
    filters.department !== "all" ||
    filters.country !== "all" ||
    filters.query.trim() !== ""
  );
}

/** Direct port of the source's filt() — applied to any FinanceLedgerRow[] before a screen computes its own view. */
export function applyFinanceFilters(rows: FinanceLedgerRow[], filters: FinanceFilters): FinanceLedgerRow[] {
  if (!isFinanceFiltersActive(filters)) return rows;
  const query = filters.query.trim().toLowerCase();
  return rows.filter((r) => {
    if (filters.fy !== "all" && String(fyOf(r.month)) !== String(filters.fy)) return false;
    if (filters.start !== "all" && r.month < filters.start) return false;
    if (filters.end !== "all" && r.month > filters.end) return false;
    if (
      filters.department !== "all" &&
      r.managementDepartment !== filters.department &&
      r.effectiveHead !== filters.department
    ) {
      return false;
    }
    if (filters.country !== "all" && (r.country ?? "") !== filters.country) return false;
    if (query) {
      const haystack = `${r.description} ${r.reportingSupplier ?? ""} ${r.traceSupplier}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}
