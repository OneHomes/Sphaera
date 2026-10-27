"use client";

import { createContext, useContext, useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  DEFAULT_FINANCE_FILTERS,
  applyFinanceFilters,
  type FinanceFilters,
} from "@/lib/finance/financeFilters";
import type { FinanceLedgerRow } from "@/lib/finance/ledgerData";

type FinanceFilterContextValue = {
  filters: FinanceFilters;
  setFilter: (key: keyof FinanceFilters, value: string) => void;
  clearFilters: () => void;
};

const FinanceFilterContext = createContext<FinanceFilterContextValue>({
  filters: DEFAULT_FINANCE_FILTERS,
  setFilter: () => {},
  clearFilters: () => {},
});

// URL-persisted (shareable/bookmarkable, survives navigation between
// screens) rather than React state — the global filter bar lives in the
// shared Finance layout and must keep its values as the user moves between
// sibling routes, exactly like the source app's single persistent `S`
// filter object.
export function FinanceFilterProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters: FinanceFilters = useMemo(
    () => ({
      fy: searchParams.get("fy") ?? DEFAULT_FINANCE_FILTERS.fy,
      start: searchParams.get("start") ?? DEFAULT_FINANCE_FILTERS.start,
      end: searchParams.get("end") ?? DEFAULT_FINANCE_FILTERS.end,
      department: searchParams.get("dept") ?? DEFAULT_FINANCE_FILTERS.department,
      country: searchParams.get("country") ?? DEFAULT_FINANCE_FILTERS.country,
      query: searchParams.get("q") ?? DEFAULT_FINANCE_FILTERS.query,
    }),
    [searchParams]
  );

  function setFilter(key: keyof FinanceFilters, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    const paramKey = key === "department" ? "dept" : key === "query" ? "q" : key;
    if (!value || value === "all") {
      params.delete(paramKey);
    } else {
      params.set(paramKey, value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearFilters() {
    router.push(pathname);
  }

  return (
    <FinanceFilterContext.Provider value={{ filters, setFilter, clearFilters }}>
      {children}
    </FinanceFilterContext.Provider>
  );
}

export function useFinanceFilters() {
  return useContext(FinanceFilterContext);
}

/** Applies the active global filter bar to any Finance screen's row list. */
export function useFilteredFinanceRows<T extends FinanceLedgerRow>(rows: T[]): T[] {
  const { filters } = useFinanceFilters();
  return useMemo(() => applyFinanceFilters(rows, filters) as T[], [rows, filters]);
}
