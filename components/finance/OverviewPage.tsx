"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import Link from "next/link";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { useFilteredFinanceRows, useFinanceFilters } from "./FinanceFilterContext";
import type { FinanceState } from "@/lib/finance/ledgerData";

type OverheadRule = { costHead: string; costNature: string; costBehaviour: string };

const DONUT_COLORS = ["#14b8a6", "#ef4444", "#f59e0b", "#d4af37", "#9ca3af", "#7965bd", "#60a5fa", "#fb923c"];

function usd(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (compact && Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${Math.round(value).toLocaleString()}`;
}

// Direct structural/content port of the source app's overview() (server
// render function, index.html) — same 8 KPI cards (same titles/formulas/
// detail copy), same chart + donut split panel, same "fixed overheads by
// department" panel, same "where management should focus next" action
// cards, same closing footnote. Only the visual implementation (Sphaera's
// WidgetCard/recharts/Tailwind) replaces the original's bespoke CSS/SVG —
// this is a re-skin, not a redesign.
function Kpi({
  title,
  value,
  detail,
  color,
  href,
}: {
  title: string;
  value: string;
  detail: string;
  color?: "teal" | "red" | "purple" | "amber";
  href?: string;
}) {
  const colorClass =
    color === "teal"
      ? "text-status-active"
      : color === "red"
        ? "text-status-inactive"
        : color === "purple"
          ? "text-[#7965bd]"
          : color === "amber"
            ? "text-status-alert"
            : "text-ink-50";
  const content = (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4 transition hover:border-base-600">
      <h4 className="text-[11px] text-ink-500">{title}</h4>
      <div className={`mt-1 text-xl font-semibold ${colorClass}`}>{value}</div>
      <div className="mt-1 text-[11px] text-ink-500">{detail}</div>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

export function OverviewPage({
  state: rawState,
  overheadRules,
}: {
  state: FinanceState;
  overheadRules: OverheadRule[];
}) {
  // Scoped by the global Finance filter bar — overview() in the source app
  // calls filt() first, exactly like this.
  const state = { ...rawState, transactions: useFilteredFinanceRows(rawState.transactions) };
  const { filters } = useFinanceFilters();
  // Direct port of the source's budgetOk() — country/keyword filters can't
  // be reliably matched to the company-wide monthly budget figures.
  const budgetOk = filters.country === "all" && !filters.query.trim();
  const [fixedDept, setFixedDept] = useState<string>("all");

  const activeDepartments = new Set(state.departments);
  const isOperating = (t: FinanceState["transactions"][number]) =>
    Boolean(t.managementDepartment) && activeDepartments.has(t.managementDepartment!) && t.debtPeriod === "current";

  const operating = state.transactions.filter(isOperating);
  const debtRows = state.transactions.filter((t) => t.debtPeriod !== "current");
  const unidentified = state.transactions.filter((t) => !t.managementDepartment);
  const opex = operating.reduce((s, t) => s + t.amount, 0);
  const debt = debtRows.reduce((s, t) => s + t.amount, 0);
  const cash = state.monthly.reduce((s, m) => s + m.collections, 0);
  const allMovements = state.transactions.reduce((s, t) => s + t.amount, 0);
  const cashGap = cash - opex;

  const monthRows = state.monthly.map((m) => {
    const monthOpex = operating.filter((t) => t.month === m.month).reduce((s, t) => s + t.amount, 0);
    const hasBudget = m.opexBudget > 0;
    return {
      month: m.month,
      opex: monthOpex,
      budget: m.opexBudget,
      collections: m.collections,
      variance: hasBudget ? monthOpex - m.opexBudget : null,
    };
  });
  const budgetedMonths = monthRows.filter((m) => m.variance !== null);
  const actualForBudget = budgetedMonths.reduce((s, m) => s + m.opex, 0);
  const budgetTotal = budgetedMonths.reduce((s, m) => s + m.budget, 0);
  const variance = actualForBudget - budgetTotal;
  const overBudgetCount = budgetedMonths.filter((m) => (m.variance ?? 0) > 0).length;

  const spendByDepartment = new Map<string, number>();
  for (const t of operating) {
    const key = t.managementDepartment!;
    spendByDepartment.set(key, (spendByDepartment.get(key) ?? 0) + t.amount);
  }
  const donutData = Array.from(spendByDepartment.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // "Fixed overheads by department" panel — rule lookup by the payment's
  // own managementCostHead, matching the source's ohRule(t) join exactly.
  const ruleByHead = new Map(overheadRules.map((r) => [r.costHead, r]));
  const fixedOverheadRows = operating.filter((t) => {
    const rule = t.managementCostHead ? ruleByHead.get(t.managementCostHead) : undefined;
    return rule?.costNature === "overhead" && rule?.costBehaviour === "fixed";
  });
  const fixedScoped = fixedDept === "all" ? fixedOverheadRows : fixedOverheadRows.filter((t) => t.managementDepartment === fixedDept);
  const fixedTotal = fixedScoped.reduce((s, t) => s + t.amount, 0);
  const fixedByDept = new Map<string, number>();
  for (const t of fixedOverheadRows) {
    fixedByDept.set(t.managementDepartment!, (fixedByDept.get(t.managementDepartment!) ?? 0) + t.amount);
  }
  const fixedByCostHead = new Map<string, number>();
  for (const t of fixedScoped) {
    const key = t.effectiveCentre ?? "Unlabelled";
    fixedByCostHead.set(key, (fixedByCostHead.get(key) ?? 0) + t.amount);
  }

  // "Where management should focus next" — same 3 fixed priorities.
  const worstOverMonth = budgetedMonths.filter((m) => (m.variance ?? 0) > 0).sort((a, b) => (b.variance ?? 0) - (a.variance ?? 0))[0];
  const missingBudgetMonths = monthRows.filter((m) => m.variance === null).length;

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-50">The commercial position, in plain English</h1>
        <p className="mt-1 text-sm text-ink-500">
          See which months are overspending, where the cash gaps are, and which costs are carrying over from last
          year.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title="Classified current-year spending"
          value={usd(opex, true)}
          detail="Excludes anything you mark as historical debt"
          href="/finance/payments"
        />
        <Kpi
          title="Cash collections reported"
          value={usd(cash, true)}
          detail={`${state.monthly.filter((m) => m.collections > 0).length} months of collection figures available`}
          color="teal"
          href="/finance/budget"
        />
        <Kpi
          title="Operating budget variance"
          value={budgetedMonths.length ? `${variance >= 0 ? "+" : ""}${usd(variance, true)}` : "Not available"}
          detail={
            budgetOk
              ? `${budgetedMonths.length} months with actual budgets, ${variance > 0 ? "over" : "under"} budget`
              : "Clear head/country filters for a total budget comparison"
          }
          color={variance > 0 ? "red" : "teal"}
          href="/finance/budget"
        />
        <Kpi
          title="Historical debt cleared"
          value={usd(debt, true)}
          detail={`${debtRows.length} payments tagged as prior-year obligations`}
          color="purple"
          href="/finance/historical-debt"
        />
        <Kpi
          title="Payments needing cost heads"
          value={String(unidentified.length)}
          detail={`${usd(unidentified.reduce((s, t) => s + t.amount, 0), true)} requiring classification`}
          color={unidentified.length ? "amber" : "teal"}
          href="/finance/needs-allocation"
        />
        <Kpi
          title="Cash coverage gap"
          value={usd(cashGap, true)}
          detail="Collections minus current-year operating spend, not profit"
          color={cashGap < 0 ? "red" : "teal"}
          href="/finance/budget"
        />
        <Kpi
          title="All recorded cash movements"
          value={usd(allMovements, true)}
          detail={`${state.transactions.length.toLocaleString()} transaction rows, includes non-operating movements`}
          href="/finance/payments"
        />
        <Kpi
          title="Months above budget"
          value={`${overBudgetCount} / ${budgetedMonths.length}`}
          detail="Only months with a budget are counted"
          color={overBudgetCount > 0 ? "red" : "teal"}
          href="/finance/budget"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WidgetCard
          title="Cash collected vs operating spending"
          action={<span className="rounded-full bg-base-800 px-2 py-0.5 text-[11px] text-ink-300">Select a month to drill down</span>}
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#232327" />
              <XAxis dataKey="month" stroke="#71717a" fontSize={10} />
              <YAxis stroke="#71717a" fontSize={10} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip
                contentStyle={{ background: "#1a1a1d", border: "1px solid #232327", fontSize: 11 }}
                formatter={(value) => [`$${Number(value ?? 0).toLocaleString()}`]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="collections" name="Collections" fill="#14b8a6" />
              <Bar dataKey="opex" name="Operating spend" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-2 text-[11px] text-ink-500">
            Collections and expenditure are different accounting measures. This chart helps assess cash coverage, it
            is not a profit and loss statement.
          </p>
        </WidgetCard>

        <WidgetCard
          title={filters.department !== "all" ? `Where ${filters.department} spending goes` : "Where the current-year classified money goes"}
          action={
            <Link href="/finance/explorer" className="text-[11px] text-ink-300 hover:text-ink-50">
              Open explorer ↗
            </Link>
          }
        >
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85}>
                {donutData.map((_, i) => (
                  <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#1a1a1d", border: "1px solid #232327", fontSize: 11 }}
                formatter={(value, name) => [usd(Number(value ?? 0)), String(name)]}
              />
            </PieChart>
          </ResponsiveContainer>
          <p className="mt-2 text-[11px] text-ink-500">
            Click a doughnut slice to see where the money goes, right down to each payment.
          </p>
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard
          title="Fixed overheads by department"
          action={
            <select
              value={fixedDept}
              onChange={(e) => setFixedDept(e.target.value)}
              className="rounded-lg border border-base-700 bg-base-800 px-2 py-1 text-[11px] text-ink-50 outline-none"
            >
              <option value="all">All departments</option>
              {state.departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          }
        >
          <p className="mb-3 text-[11px] text-ink-500">
            Approved recurring fixed overhead payments for the active year and date filters. Management cash view,
            not a payroll forecast or accrual P&amp;L.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-base-700 bg-base-800 p-3">
              <p className="text-[11px] text-ink-500">Fixed overhead payments</p>
              <p className="mt-1 text-lg font-semibold text-ink-50">{usd(fixedTotal, true)}</p>
              <p className="mt-1 text-[11px] text-ink-500">{fixedDept === "all" ? "All departments" : fixedDept} · selected reporting period</p>
            </div>
            <div className="rounded-lg border border-base-700 bg-base-800 p-3">
              <p className="text-[11px] text-ink-500">Underlying records</p>
              <p className="mt-1 text-lg font-semibold text-ink-50">{fixedScoped.length}</p>
              <p className="mt-1 text-[11px] text-ink-500">Payments contributing to fixed overhead</p>
            </div>
            <div className="rounded-lg border border-base-700 bg-base-800 p-3">
              <p className="text-[11px] text-ink-500">Unreviewed cost entries</p>
              <p className="mt-1 text-lg font-semibold text-ink-50">
                {operating.filter((t) => !t.managementCostHead || !ruleByHead.has(t.managementCostHead)).length}
              </p>
              <p className="mt-1 text-[11px] text-ink-500">Not included until classified by Finance</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <h4 className="mb-1.5 text-xs font-medium text-ink-50">Cost heads</h4>
              {Array.from(fixedByCostHead.entries()).length === 0 && (
                <p className="text-[11px] text-ink-500">No approved fixed-overhead payments in this selection.</p>
              )}
              {Array.from(fixedByCostHead.entries()).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-base-800 py-1 text-xs">
                  <span className="text-ink-300">{k}</span>
                  <span className="font-medium text-ink-50">{usd(v)}</span>
                </div>
              ))}
            </div>
            <div>
              <h4 className="mb-1.5 text-xs font-medium text-ink-50">
                {fixedDept === "all" ? "Department comparison" : "By department"}
              </h4>
              {Array.from(fixedByDept.entries()).length === 0 && (
                <p className="text-[11px] text-ink-500">Nothing classified as fixed in this selection.</p>
              )}
              {Array.from(fixedByDept.entries()).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-base-800 py-1 text-xs">
                  <span className="text-ink-300">{k}</span>
                  <span className="font-medium text-ink-50">{usd(v)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <Link href="/finance/overheads" className="text-[11px] text-ink-300 hover:text-ink-50">
              Open full overhead analysis ↗
            </Link>
          </div>
        </WidgetCard>
      </div>

      <div className="mb-3 mt-5">
        <h2 className="text-base font-semibold text-ink-50">Where management should focus next</h2>
        <p className="mt-1 text-xs text-ink-500">
          Actionable observations from the current records, not predictions or claims about sales return on
          investment.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-base-700 bg-base-900 p-4">
          <p className="text-[10px] uppercase tracking-wide text-ink-500">Priority 01 · Cost control</p>
          <h4 className="mt-1 text-sm font-medium text-ink-50">
            {worstOverMonth ? `${worstOverMonth.month} overspent ${usd(worstOverMonth.variance ?? 0, true)}` : "Set monthly budget controls"}
          </h4>
          <p className="mt-1 text-xs text-ink-500">
            {worstOverMonth
              ? "Review the individual transactions in the worst month before approving next year's spend. Identify exceptional expenses and ongoing run-rate increases."
              : "Make each cost head owner accountable for monthly budget utilisation."}
          </p>
          <Link href="/finance/budget" className="mt-2 inline-block text-[11px] text-ink-300 hover:text-ink-50">
            Review monthly budgets →
          </Link>
        </div>
        <div className="rounded-xl border border-base-700 bg-base-900 p-4">
          <p className="text-[10px] uppercase tracking-wide text-ink-500">Priority 02 · Data quality</p>
          <h4 className="mt-1 text-sm font-medium text-ink-50">{unidentified.length} payments need a cost head</h4>
          <p className="mt-1 text-xs text-ink-500">
            {unidentified.length
              ? `${usd(unidentified.reduce((s, t) => s + t.amount, 0))} cannot be reliably interpreted as an operating expense until verified.`
              : "All current payments have a cost head, continue checking new imports."}
            {missingBudgetMonths > 0 && ` There are ${missingBudgetMonths} months without operating budgets.`}
          </p>
          <Link href="/finance/needs-allocation" className="mt-2 inline-block text-[11px] text-ink-300 hover:text-ink-50">
            Review payments →
          </Link>
        </div>
        <div className="rounded-xl border border-base-700 bg-base-900 p-4">
          <p className="text-[10px] uppercase tracking-wide text-ink-500">Priority 03 · Future planning</p>
          <h4 className="mt-1 text-sm font-medium text-ink-50">Separate debt cleanup from ongoing costs</h4>
          <p className="mt-1 text-xs text-ink-500">
            {usd(debt)} is tagged as prior-year debt. This should be visible separately from the next financial
            year&apos;s operating budget, but remains part of cash paid.
          </p>
          <Link href="/finance/historical-debt" className="mt-2 inline-block text-[11px] text-ink-300 hover:text-ink-50">
            See historical debt →
          </Link>
        </div>
      </div>

      <div className="mt-5 text-[11px] text-ink-600">
        Initial dataset: November 2025 to July 2026. New months are included automatically after import. Any
        financial-year budget that has not been supplied is labelled unavailable, rather than assumed.
      </div>
    </div>
  );
}
