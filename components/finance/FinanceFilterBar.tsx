"use client";

import { useState } from "react";
import { useFinanceFilters } from "./FinanceFilterContext";
import type { FinanceFilterOptions } from "@/lib/finance/ledgerData";

const fieldLabelClass = "text-[10px] font-medium uppercase tracking-wide text-ink-500";
const selectClass =
  "mt-1 w-full rounded-lg border border-base-700 bg-base-800 px-2.5 py-1.5 text-xs text-ink-50 outline-none focus:border-base-600";

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

// Direct structural port of the source app's renderTop() filter row —
// Financial year / From month / To month / Department / Country / Search
// payments / Clear filters — rendered once in the shared Finance layout so
// every screen is scoped by the same global filter, exactly like the
// source's single persistent `S` filter object.
export function FinanceFilterBar({ options }: { options: FinanceFilterOptions }) {
  const { filters, setFilter, clearFilters } = useFinanceFilters();
  const [query, setQuery] = useState(filters.query);

  return (
    <div className="grid grid-cols-2 gap-3 border-b border-base-800 bg-base-900 px-6 py-3 sm:grid-cols-3 lg:grid-cols-6">
      <label className={fieldLabelClass}>
        Financial year
        <select value={filters.fy} onChange={(e) => setFilter("fy", e.target.value)} className={selectClass}>
          <option value="all">All years</option>
          {options.fyYears.map((y) => (
            <option key={y} value={y}>
              FY{y}/{String((y + 1) % 100).padStart(2, "0")}
            </option>
          ))}
        </select>
      </label>
      <label className={fieldLabelClass}>
        From month
        <select value={filters.start} onChange={(e) => setFilter("start", e.target.value)} className={selectClass}>
          <option value="all">All months</option>
          {options.months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </label>
      <label className={fieldLabelClass}>
        To month
        <select value={filters.end} onChange={(e) => setFilter("end", e.target.value)} className={selectClass}>
          <option value="all">All months</option>
          {options.months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </label>
      <label className={fieldLabelClass}>
        Department
        <select value={filters.department} onChange={(e) => setFilter("department", e.target.value)} className={selectClass}>
          <option value="all">All departments</option>
          {options.departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <label className={fieldLabelClass}>
        Country
        <select value={filters.country} onChange={(e) => setFilter("country", e.target.value)} className={selectClass}>
          <option value="all">All countries</option>
          {options.countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end gap-2 sm:col-span-3 lg:col-span-1">
        <label className={`flex-1 ${fieldLabelClass}`}>
          Search payments
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => setFilter("query", query)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setFilter("query", query);
            }}
            placeholder="Person, supplier, description…"
            className={selectClass}
          />
        </label>
        <button
          onClick={() => {
            setQuery("");
            clearFilters();
          }}
          className="mb-0.5 whitespace-nowrap rounded-lg border border-base-700 px-2.5 py-1.5 text-xs text-ink-300 hover:border-base-600 hover:text-ink-50"
        >
          Clear filters
        </button>
      </div>
    </div>
  );
}
