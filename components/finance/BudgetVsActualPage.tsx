"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useFilteredFinanceRows, useFinanceFilters } from "./FinanceFilterContext";
import type { FinanceState } from "@/lib/finance/ledgerData";

// Direct structural/content port of the source app's budgetPage() (server
// render function, index.html line 1035) — same 4 KPI cards (same titles/
// formulas/detail copy), same monthly table columns (Month / Operating
// costs / Budget / Over-under pill / Collections / Historical debt /
// Action), same "Largest monthly overruns" / "Months below budget" split
// panels, same closing notice banner verbatim. Only the visual
// implementation (Sphaera's WidgetCard-less panel/Tailwind) replaces the
// original's bespoke CSS — this is a re-skin, not a redesign.

function usd(value: number | null, compact = false): string {
  if (value === null) return "Not available";
  if (compact && Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (compact && Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${Math.round(value).toLocaleString()}`;
}

function mo(month: string): string {
  if (!month) return "";
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function Kpi({
  title,
  value,
  detail,
  color,
}: {
  title: string;
  value: string;
  detail: string;
  color?: "teal" | "red" | "amber";
}) {
  const colorClass =
    color === "teal"
      ? "text-status-active"
      : color === "red"
        ? "text-status-inactive"
        : color === "amber"
          ? "text-status-alert"
          : "text-ink-50";
  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <h4 className="text-[11px] text-ink-500">{title}</h4>
      <div className={`mt-1 text-xl font-semibold ${colorClass}`}>{value}</div>
      <div className="mt-1 text-[11px] text-ink-500">{detail}</div>
    </div>
  );
}

type MonthRow = {
  month: string;
  opex: number;
  budget: number | null;
  hasBudget: boolean;
  collections: number;
  debt: number;
  variance: number | null;
  awaitingActuals: boolean;
};

export function BudgetVsActualPage({ state: rawState }: { state: FinanceState }) {
  // Scoped by the global Finance filter bar — budgetPage() in the source
  // app calls filt() first, exactly like this.
  const state = { ...rawState, transactions: useFilteredFinanceRows(rawState.transactions) };
  const { filters } = useFinanceFilters();
  // Direct port of the source's budgetOk() — department-level comparisons
  // use approved cost-head budgets, but country/keyword filters can't be
  // reliably matched to a budget, so the comparison warns when they're set.
  const budgetOk = filters.country === "all" && !filters.query.trim();
  const activeDepartments = new Set(state.departments);
  const isOperating = (t: FinanceState["transactions"][number]) =>
    Boolean(t.managementDepartment) && activeDepartments.has(t.managementDepartment!) && t.debtPeriod === "current";

  const monthRows: MonthRow[] = useMemo(() => {
    return state.monthly.map((m) => {
      const monthTx = state.transactions.filter((t) => t.month === m.month);
      const opex = monthTx.filter(isOperating).reduce((s, t) => s + t.amount, 0);
      const debt = monthTx.filter((t) => t.debtPeriod !== "current").reduce((s, t) => s + t.amount, 0);
      const hasActual = monthTx.length > 0;
      const hasBudget = m.opexBudget > 0;
      const variance = !hasBudget || !hasActual ? null : opex - m.opexBudget;
      return {
        month: m.month,
        opex,
        budget: hasBudget ? m.opexBudget : null,
        hasBudget,
        collections: m.collections,
        debt,
        variance,
        awaitingActuals: !hasActual,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.monthly, state.transactions, state.departments]);

  const budgetedMonths = monthRows.filter((m) => m.variance !== null);
  const bud = budgetedMonths.reduce((s, m) => s + (m.budget ?? 0), 0);
  const cur = budgetedMonths.reduce((s, m) => s + m.opex, 0);
  const netVariance = cur - bud;
  const missing = monthRows.filter((m) => !m.hasBudget);

  const over = monthRows
    .filter((m) => m.variance !== null && m.variance > 0)
    .sort((a, b) => (b.variance ?? 0) - (a.variance ?? 0));
  const under = monthRows
    .filter((m) => m.variance !== null && m.variance <= 0)
    .sort((a, b) => (a.variance ?? 0) - (b.variance ?? 0));

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-50">Budget performance, month by month</h1>
        <p className="mt-1 text-sm text-ink-500">
          Overspending is shown in red, savings in green. Select any month for all underlying payments.
        </p>
      </div>

      {!budgetOk && (
        <div className="mb-4 rounded-xl border border-tier-gold/30 bg-tier-gold/10 p-3 text-xs text-tier-gold">
          Department-level comparisons use approved cost-head budgets. Country or keyword filters cannot be matched
          to budgets reliably, so clear them for a complete comparison.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title="Budget for months reported"
          value={usd(bud, true)}
          detail={`${budgetedMonths.length} months have budgets and recorded actuals`}
        />
        <Kpi
          title="Operating cost, budgeted months"
          value={usd(cur, true)}
          detail="Current-year costs in months with a budget"
        />
        <Kpi
          title="Net variance"
          value={budgetedMonths.length ? usd(netVariance, true) : "Awaiting actuals"}
          detail={budgetedMonths.length ? (netVariance > 0 ? "Operating overspend" : "Operating saving") : "No comparable actuals yet"}
          color={netVariance > 0 ? "red" : "teal"}
        />
        <Kpi
          title="Missing month budgets"
          value={String(missing.length)}
          detail="Enter budget figures to complete the comparison"
          color={missing.length ? "amber" : "teal"}
        />
      </div>

      <div className="mt-4 rounded-xl border border-base-700 bg-base-900 p-4">
        <h3 className="mb-3 text-sm font-medium text-ink-50">Monthly operating costs, plan and cash coverage</h3>
        <div className="overflow-x-auto rounded-xl border border-base-700">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-base-700 bg-base-900 text-ink-500">
              <tr>
                <th className="px-3 py-2">Month</th>
                <th className="px-3 py-2 text-right">Operating costs</th>
                <th className="px-3 py-2 text-right">Budget</th>
                <th className="px-3 py-2 text-right">Over / under</th>
                <th className="px-3 py-2 text-right">Collections</th>
                <th className="px-3 py-2 text-right">Historical debt</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {monthRows.map((x) => (
                <tr key={x.month} className="border-b border-base-800 text-ink-300 last:border-0">
                  <td className="px-3 py-2 font-medium text-ink-50">{mo(x.month)}</td>
                  <td className="px-3 py-2 text-right">{usd(x.opex)}</td>
                  <td className="px-3 py-2 text-right">{usd(x.budget)}</td>
                  <td className="px-3 py-2 text-right">
                    {x.variance === null ? (
                      <span className="rounded-full bg-status-alert/15 px-2 py-0.5 text-[11px] font-medium text-status-alert">
                        {x.awaitingActuals ? "Awaiting actuals" : "No comparable budget"}
                      </span>
                    ) : (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          x.variance > 0
                            ? "bg-status-inactive/15 text-status-inactive"
                            : "bg-status-active/15 text-status-active"
                        }`}
                      >
                        {x.variance > 0 ? "Over " : "Under "}
                        {usd(Math.abs(x.variance))}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{usd(x.collections)}</td>
                  <td className="px-3 py-2 text-right">{usd(x.debt)}</td>
                  <td className="px-3 py-2">
                    <Link
                      href="/finance/planning"
                      className="rounded-md border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:text-ink-50"
                    >
                      Planning ↗
                    </Link>
                  </td>
                </tr>
              ))}
              {monthRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-ink-500">
                    No months recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-base-700 bg-base-900 p-4">
          <h3 className="mb-2 text-sm font-medium text-ink-50">Largest monthly overruns</h3>
          {over.length === 0 && <p className="text-[11px] text-ink-500">No month overruns for the chosen period.</p>}
          {over.slice(0, 7).map((x) => (
            <div key={x.month} className="flex items-center justify-between border-b border-base-800 py-1.5 text-xs last:border-0">
              <strong className="text-ink-50">{mo(x.month)}</strong>
              <b className="text-status-inactive">+{usd(x.variance)}</b>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-base-700 bg-base-900 p-4">
          <h3 className="mb-2 text-sm font-medium text-ink-50">Months below budget</h3>
          {under.length === 0 && <p className="text-[11px] text-ink-500">No months below budget for the chosen period.</p>}
          {under.slice(0, 7).map((x) => (
            <div key={x.month} className="flex items-center justify-between border-b border-base-800 py-1.5 text-xs last:border-0">
              <strong className="text-ink-50">{mo(x.month)}</strong>
              <b className="text-status-active">{usd(x.variance)}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-base-700 bg-base-900 p-4 text-xs text-ink-300">
        A month that is under budget is not necessarily more successful, and a month that is over budget is not
        necessarily unsuccessful. Assess spend alongside booked sales and collection performance, which are not
        fully available for later months in the source workbook.
      </div>
    </div>
  );
}
