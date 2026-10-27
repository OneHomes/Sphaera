"use client";

import { useMemo, useState } from "react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import type { FinanceState } from "@/lib/finance/ledgerData";

// Duplicated locally rather than imported from
// lib/finance/financialPlanningData.ts — that file imports `prisma` and
// `exceljs` at module scope, which must never end up in a client bundle
// (confirmed: importing it here alone ballooned this page's JS from ~3KB
// to ~389KB). Same precaution the Financial Planning screen's own
// client component already takes for these exact two pure functions.
function financeFiscalYearStart(date: Date): number {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  return month >= 11 ? year : year - 1;
}
function financeFyName(fyStart: number): string {
  return `FY${fyStart}/${String((fyStart + 1) % 100).padStart(2, "0")}`;
}

function usd(value: number): string {
  return `${value < 0 ? "-" : ""}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

export function WeeklyCeoBriefPage({ state }: { state: FinanceState }) {
  const [showReport, setShowReport] = useState(false);

  const fyLabel = useMemo(() => financeFyName(financeFiscalYearStart(new Date())), []);

  const summary = useMemo(() => {
    // Same "operating spend" definition as the overview screen: a payment
    // with a current-year, active-department classification.
    const activeDepartments = new Set(state.departments);
    const isOperating = (t: FinanceState["transactions"][number]) =>
      Boolean(t.managementDepartment) && activeDepartments.has(t.managementDepartment!) && t.debtPeriod === "current";
    const operating = state.transactions.filter(isOperating);
    const opex = operating.reduce((s, t) => s + t.amount, 0);

    const debtRows = state.transactions.filter((t) => t.debtPeriod !== "current");
    const debt = debtRows.reduce((s, t) => s + t.amount, 0);

    const unresolvedAllocations = state.transactions.filter((t) => !t.managementDepartment || !t.managementCostHead).length;

    const latestMonth = state.monthly[state.monthly.length - 1] ?? null;
    const byDept = new Map<string, number>();
    if (latestMonth) {
      for (const t of operating) {
        if (t.month !== latestMonth.month) continue;
        const key = t.managementDepartment!;
        byDept.set(key, (byDept.get(key) ?? 0) + t.amount);
      }
    }
    const budgetByDepartment = Array.from(byDept.entries())
      .map(([department, actual]) => ({ department, actual }))
      .sort((a, b) => b.actual - a.actual);

    return {
      opex,
      debt,
      unresolvedAllocations,
      currentMonth: latestMonth?.month ?? null,
      currentMonthBudget: latestMonth?.opexBudget ?? null,
      budgetByDepartment,
    };
  }, [state]);

  function handleDownload() {
    const payload = {
      generatedAt: new Date().toISOString(),
      fiscalYear: fyLabel,
      currentOperatingSpend: summary.opex,
      historicalDebtCleared: summary.debt,
      unresolvedAllocations: summary.unresolvedAllocations,
      currentMonth: summary.currentMonth,
      currentMonthApprovedBudget: summary.currentMonthBudget,
      budgetByDepartment: summary.budgetByDepartment,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weekly-ceo-brief-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-ink-50">Weekly CEO financial brief</h2>
        <p className="mt-1 text-sm text-ink-500">
          Generate a report from transactions and the approved annual plan for {fyLabel}.
        </p>
      </div>

      <div className="mb-4 rounded-xl border border-status-alert/40 bg-status-alert/10 p-3 text-xs text-status-alert">
        Automatic weekly delivery requires an always-running hosted server and company mail integration. This local
        version prepares the report on demand and does not email anyone yet.
      </div>

      <WidgetCard title="Get your weekly report">
        <p className="text-xs text-ink-500">
          Includes classified actual payments, historical debt cleared, unresolved allocations, and approved
          budgets by department. All sourced directly from SQLite.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setShowReport((v) => !v)}
            className="rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white"
          >
            {showReport ? "Collapse report" : "Open readable CEO report ↗"}
          </button>
          <button
            onClick={handleDownload}
            className="rounded-lg border border-base-700 px-3 py-1.5 text-xs text-ink-300 hover:border-base-600 hover:text-ink-50"
          >
            Download report data (JSON)
          </button>
        </div>

        {showReport && (
          <div className="mt-4 rounded-lg border border-base-700 bg-base-800 p-4 text-xs text-ink-300">
            <h4 className="mb-3 text-sm font-medium text-ink-50">Weekly CEO report — {fyLabel}</h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <p className="text-[11px] text-ink-500">Current operating spend</p>
                <p className="mt-1 text-base font-semibold text-ink-50">{usd(summary.opex)}</p>
              </div>
              <div>
                <p className="text-[11px] text-ink-500">Historical debt cleared</p>
                <p className="mt-1 text-base font-semibold text-ink-50">{usd(summary.debt)}</p>
              </div>
              <div>
                <p className="text-[11px] text-ink-500">Unresolved allocations</p>
                <p className="mt-1 text-base font-semibold text-status-alert">{summary.unresolvedAllocations}</p>
              </div>
            </div>

            <h5 className="mb-1.5 mt-4 text-xs font-medium text-ink-50">
              Budget by department{summary.currentMonth ? ` · ${summary.currentMonth}` : ""}
            </h5>
            {summary.budgetByDepartment.length === 0 ? (
              <p className="text-[11px] text-ink-500">No classified spend recorded for the current month.</p>
            ) : (
              <div>
                {summary.budgetByDepartment.map((d) => (
                  <div
                    key={d.department}
                    className="flex items-center justify-between border-b border-base-700 py-1"
                  >
                    <span className="text-ink-300">{d.department}</span>
                    <span className="font-medium text-ink-50">{usd(d.actual)}</span>
                  </div>
                ))}
                {summary.currentMonthBudget !== null && (
                  <div className="mt-2 flex items-center justify-between text-[11px] text-ink-500">
                    <span>Total approved budget, {summary.currentMonth}</span>
                    <span>{usd(summary.currentMonthBudget)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </WidgetCard>
    </div>
  );
}
