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
  setFilters: (values: Partial<FinanceFilters>) => void;
  clearFilters: () => void;
};

const FinanceFilterContext = createContext<FinanceFilterContextValue>({
  filters: DEFAULT_FINANCE_FILTERS,
  setFilter: () => {},
  setFilters: () => {},
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

  function setFilters(values: Partial<FinanceFilters>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(values) as [keyof FinanceFilters, string][]) {
      const paramKey = key === "department" ? "dept" : key === "query" ? "q" : key;
      if (key === "fy") {
        if (value === DEFAULT_FINANCE_FILTERS.fy) params.delete(paramKey);
        else params.set(paramKey, value || "all");
      } else if (!value || value === "all") {
        params.delete(paramKey);
      } else {
        params.set(paramKey, value);
      }
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function setFilter(key: keyof FinanceFilters, value: string) {
    setFilters({ [key]: value });
  }

  function clearFilters() {
    router.push(pathname);
  }

  return (
    <FinanceFilterContext.Provider value={{ filters, setFilter, setFilters, clearFilters }}>
      {children}
    </FinanceFilterContext.Provider>
  );
}

type FinanceLookups = { sourceNames: Map<string, string>; subscriptionNames: Map<string, string> };
const FinanceLookupContext = createContext<FinanceLookups>({ sourceNames: new Map(), subscriptionNames: new Map() });

/** Name lookups shared by every Finance screen (payment sources, subscriptions). */
export function FinanceLookupProvider({
  paymentSources,
  subscriptions,
  children,
}: {
  paymentSources: { id: string; name: string }[];
  subscriptions: { id: string; service: string }[];
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({
      sourceNames: new Map(paymentSources.map((s) => [s.id, s.name])),
      subscriptionNames: new Map(subscriptions.map((s) => [s.id, s.service])),
    }),
    [paymentSources, subscriptions]
  );
  return <FinanceLookupContext.Provider value={value}>{children}</FinanceLookupContext.Provider>;
}

export function useFinanceLookups() {
  return useContext(FinanceLookupContext);
}

export function useFinanceFilters() {
  return useContext(FinanceFilterContext);
}

/** Applies the active global filter bar to any Finance screen's row list. */
export function useFilteredFinanceRows<T extends FinanceLedgerRow>(rows: T[]): T[] {
  const { filters } = useFinanceFilters();
  return useMemo(() => applyFinanceFilters(rows, filters) as T[], [rows, filters]);
}
