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
  Sector,
} from "recharts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { useFilteredFinanceRows, useFinanceFilters } from "./FinanceFilterContext";
import { fyOf } from "@/lib/finance/financeFilters";
import type { FinanceState } from "@/lib/finance/ledgerData";

type OverheadRule = { costHead: string; costNature: string; costBehaviour: string };

const DONUT_COLORS = ["#009c91", "#2d6c85", "#e9a14b", "#8167b8", "#6ab4cc", "#d66b6e", "#8dad67", "#d9b95c", "#b4bed1"];

function mo(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

const exactUsd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

function usd(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (compact && Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${Math.round(value).toLocaleString()}`;
}

// Port of the source's `.donut-plot .segment:hover` thicker-ring rule.
function renderDonutSector(
  props: { cx?: number; cy?: number; innerRadius?: number; outerRadius?: number; startAngle?: number; endAngle?: number; fill?: string; index: number; isActive: boolean },
  hoveredIndex: number | undefined
) {
  const lifted = props.isActive || props.index === hoveredIndex;
  return (
    <Sector
      cx={props.cx}
      cy={props.cy}
      innerRadius={props.innerRadius}
      outerRadius={(props.outerRadius ?? 0) + (lifted ? 6 : 0)}
      startAngle={props.startAngle}
      endAngle={props.endAngle}
      fill={props.fill}
      style={lifted ? { filter: "brightness(1.06)" } : undefined}
    />
  );
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
    <div className="relative rounded-xl border border-base-700 bg-base-900 p-4 transition hover:border-base-600">
      {href && <span className="absolute right-3 top-3 text-xs text-ink-500">↗</span>}
      <h4 className="pr-4 text-[11px] text-ink-500">{title}</h4>
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
  const noTextFilters = filters.country === "all" && !filters.query.trim();
  const budgetOk =
    noTextFilters &&
    filters.department === "all" &&
    !rawState.transactions.some((t) => !t.managementDepartment || !t.managementCostHead);
  const [fixedDept, setFixedDept] = useState<string>("all");
  const [hoveredDonutIndex, setHoveredDonutIndex] = useState<number | undefined>(undefined);
  const router = useRouter();
  // Source: clicking a month group opens All Payments drilled to that month.
  const openMonth = (data: unknown) => {
    const month = (data as { month?: string; payload?: { month?: string } })?.payload?.month ?? (data as { month?: string })?.month;
    if (month) router.push(`/finance/payments?month=${encodeURIComponent(month)}`);
  };

  const activeDepartments = new Set(state.departments);
  const isOperating = (t: FinanceState["transactions"][number]) =>
    Boolean(t.managementDepartment) && activeDepartments.has(t.managementDepartment!) && t.debtPeriod === "current";

  const operating = state.transactions.filter(isOperating);
  const debtRows = state.transactions.filter((t) => t.debtPeriod !== "current");
  const unidentified = state.transactions.filter((t) => !t.managementDepartment || !t.managementCostHead);
  const opex = operating.reduce((s, t) => s + t.amount, 0);
  const debt = debtRows.reduce((s, t) => s + t.amount, 0);
  const allMovements = state.transactions.reduce((s, t) => s + t.amount, 0);

  // Direct port of relevantMonths() + monthlyNumbers(): the chart and the
  // collections/budget KPIs follow the global FY / From / To filters, and a
  // budget is only comparable when no department/country/keyword filter is
  // narrowing actual spend (the stored budget is company-wide).
  const monthSet = new Set([
    ...rawState.monthly.map((m) => m.month),
    ...rawState.transactions.map((t) => t.month),
  ]);
  const relevantMonths = Array.from(monthSet)
    .sort()
    .filter(
      (m) =>
        (filters.fy === "all" || String(fyOf(m)) === filters.fy) &&
        (filters.start === "all" || m >= filters.start) &&
        (filters.end === "all" || m <= filters.end)
    );
  const budgetComparable = noTextFilters && filters.department === "all";
  const monthRows = relevantMonths.map((month) => {
    const m = rawState.monthly.find((x) => x.month === month);
    const monthOpex = operating.filter((t) => t.month === month).reduce((s, t) => s + t.amount, 0);
    const hasActual = rawState.transactions.some((t) => t.month === month);
    const budget = budgetComparable && m && m.opexBudget > 0 ? m.opexBudget : null;
    return {
      month,
      opex: monthOpex,
      budget: budget ?? 0,
      budgetAvailable: budget !== null,
      collections: m?.collections ?? 0,
      variance: budget !== null && hasActual ? monthOpex - budget : null,
    };
  });
  const cash = monthRows.reduce((s, m) => s + m.collections, 0);
  const cashGap = cash - opex;
  const budgetedMonths = monthRows.filter((m) => m.variance !== null);
  const actualForBudget = budgetedMonths.reduce((s, m) => s + m.opex, 0);
  const budgetTotal = budgetedMonths.reduce((s, m) => s + m.budget, 0);
  const variance = actualForBudget - budgetTotal;
  const overBudgetCount = budgetedMonths.filter((m) => (m.variance ?? 0) > 0).length;

  // Source: at the top level the donut groups by department; once a
  // department filter is set it drills one level to that department's cost
  // heads (donutWidget stage 'head' vs 'centre').
  const donutByCentre = filters.department !== "all";
  const donutHref = (name: string) =>
    donutByCentre
      ? `/finance/explorer?department=${encodeURIComponent(filters.department)}&centre=${encodeURIComponent(name)}`
      : `/finance/explorer?department=${encodeURIComponent(name)}`;
  const spendByDepartment = new Map<string, { value: number; count: number }>();
  for (const t of operating) {
    const key = donutByCentre ? t.managementCostHead ?? "Needs allocation" : t.managementDepartment!;
    const entry = spendByDepartment.get(key) ?? { value: 0, count: 0 };
    entry.value += t.amount;
    entry.count += 1;
    spendByDepartment.set(key, entry);
  }
  const groupedCosts = Array.from(spendByDepartment.entries())
    .map(([name, { value, count }]) => ({ name, value, count }))
    .sort((a, b) => b.value - a.value);
  // Direct port of donutWidget()'s "largest 8 + Other" grouping — the
  // chart and its legend only ever show up to 9 slices, with every
  // smaller entry rolled into one non-clickable "Other" row.
  const positiveCosts = groupedCosts.filter((c) => c.value > 0);
  const largestCosts = positiveCosts.slice(0, 8).map((c) => ({ ...c, other: false }));
  const remainingCosts = positiveCosts.slice(8);
  const otherCost = remainingCosts.length
    ? {
        name: donutByCentre ? "Other cost centres" : "Other heads",
        value: remainingCosts.reduce((s, c) => s + c.value, 0),
        count: remainingCosts.reduce((s, c) => s + c.count, 0),
        other: true,
      }
    : null;
  const donutData = [...largestCosts, ...(otherCost ? [otherCost] : [])];
  const donutTotal = positiveCosts.reduce((s, c) => s + c.value, 0);

  // "Fixed overheads by department" panel — rule lookup by the payment's
  // own managementCostHead, matching the source's ohRule(t) join exactly.
  const ruleByHead = new Map(overheadRules.map((r) => [r.costHead, r]));
  const ohRule = (t: FinanceState["transactions"][number]) => {
    if (t.overheadOverride) return { nature: t.overheadOverride.costNature, behaviour: t.overheadOverride.costBehaviour, reviewed: true };
    const rule = ruleByHead.get(t.managementCostHead ?? "Needs allocation");
    return rule ? { nature: rule.costNature, behaviour: rule.costBehaviour, reviewed: true } : { nature: "review", behaviour: "na", reviewed: false };
  };
  const fixedOverheadRows = operating.filter((t) => {
    const r = ohRule(t);
    return r.nature === "overhead" && r.behaviour === "fixed";
  });
  const unreviewedCount = operating.filter((t) => !ohRule(t).reviewed).length;
  const fixedScoped = fixedDept === "all" ? fixedOverheadRows : fixedOverheadRows.filter((t) => t.managementDepartment === fixedDept);
  const fixedTotal = fixedScoped.reduce((s, t) => s + t.amount, 0);
  const fixedByDept = new Map<string, number>();
  for (const t of fixedOverheadRows) {
    fixedByDept.set(t.managementDepartment!, (fixedByDept.get(t.managementDepartment!) ?? 0) + t.amount);
  }
  const fixedByCostHead = new Map<string, number>();
  const fixedByMonth = new Map<string, number>();
  for (const t of fixedScoped) {
    const key = t.managementCostHead ?? "Needs allocation";
    fixedByCostHead.set(key, (fixedByCostHead.get(key) ?? 0) + t.amount);
    fixedByMonth.set(t.month, (fixedByMonth.get(t.month) ?? 0) + t.amount);
  }
  const fixedCostHeadRows = Array.from(fixedByCostHead.entries()).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const fixedRightRows =
    fixedDept === "all"
      ? Array.from(fixedByDept.entries())
      : Array.from(fixedByMonth.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([m, v]) => [mo(m), v] as [string, number]);

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
          href="/finance/payments?mode=operating"
        />
        <Kpi
          title="Cash collections reported"
          value={usd(cash, true)}
          detail={`${monthRows.filter((m) => m.collections > 0).length} months of collection figures available`}
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
              <XAxis dataKey="month" stroke="#71717a" fontSize={10} tickFormatter={(m: string) => `${mo(m).split(" ")[0]} ${m.slice(2, 4)}`} />
              <YAxis stroke="#71717a" fontSize={10} tickFormatter={(v: number) => usd(v, true)} />
              <Tooltip
                contentStyle={{ background: "#1a1a1d", border: "1px solid #232327", fontSize: 11 }}
                labelFormatter={(m) => mo(String(m))}
                formatter={(value, name, item) => [
                  name === "Operating budget" && !(item?.payload as { budgetAvailable?: boolean })?.budgetAvailable
                    ? "Not available"
                    : exactUsd.format(Number(value ?? 0)),
                  String(name),
                ]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="collections" name="Collections" fill="#a8a29e" cursor="pointer" onClick={openMonth} />
              <Bar dataKey="opex" name="Current-year operating spend" fill="#f4f4f5" cursor="pointer" onClick={openMonth} />
              <Bar dataKey="budget" name="Operating budget" fill="#71717a" cursor="pointer" onClick={openMonth} />
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
          <p className="mb-3 text-[11px] text-ink-500">
            Click a doughnut slice to see where the money goes, right down to each payment.
          </p>
          {donutData.length === 0 ? (
            <p className="py-8 text-center text-xs text-ink-500">
              There is no spending in this selection. Change the filters above.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="relative mx-auto w-full max-w-[260px]">
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={85}
                      shape={(p) => renderDonutSector(p, hoveredDonutIndex)}
                      onMouseEnter={(_, i) => setHoveredDonutIndex(i)}
                      onMouseLeave={() => setHoveredDonutIndex(undefined)}
                      onClick={(_, i) => {
                        const item = donutData[i];
                        if (item && !item.other) router.push(donutHref(item.name));
                      }}
                      cursor="pointer"
                    >
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
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-sm font-semibold text-ink-50">{usd(donutTotal, true)}</p>
                  <p className="text-[10px] text-ink-500">positive net costs</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {donutData.map((item, i) => {
                  const share = donutTotal > 0 ? (item.value / donutTotal) * 100 : 0;
                  const row = (
                    <>
                      <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-ink-50">{item.name}</span>
                        <span className="block text-[10px] text-ink-500">
                          {item.count.toLocaleString()} {item.count === 1 ? "payment" : "payments"}
                          {!item.other && " · Click to explore"}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-xs font-semibold text-ink-50">{usd(item.value, true)}</span>
                        <span className="block text-[10px] text-ink-500">{share.toFixed(1)}%</span>
                      </span>
                    </>
                  );
                  return item.other ? (
                    <div
                      key={item.name}
                      onMouseEnter={() => setHoveredDonutIndex(i)}
                      onMouseLeave={() => setHoveredDonutIndex(undefined)}
                      className="flex items-start gap-2 rounded-lg px-2 py-1.5"
                    >
                      {row}
                    </div>
                  ) : (
                    <Link
                      key={item.name}
                      href={donutHref(item.name)}
                      onMouseEnter={() => setHoveredDonutIndex(i)}
                      onMouseLeave={() => setHoveredDonutIndex(undefined)}
                      className={`flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-base-800 ${hoveredDonutIndex === i ? "bg-base-800" : ""}`}
                    >
                      {row}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
          {remainingCosts.length > 0 && (
            <p className="mt-1 text-[11px] text-ink-500">
              The chart groups {remainingCosts.length} smaller entries as Other. Every individual cost centre and
              payment remains accessible below.
            </p>
          )}
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard
          title="Fixed overheads by department"
          action={
            <label className="flex items-center gap-2 text-[11px] text-ink-500">
            Department
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
            </label>
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
              <p className="mt-1 text-lg font-semibold text-ink-50">{unreviewedCount}</p>
              <p className="mt-1 text-[11px] text-ink-500">Not included until classified by Finance</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <h4 className="mb-1.5 text-xs font-medium text-ink-50">Cost heads</h4>
              {fixedCostHeadRows.length === 0 && (
                <p className="text-[11px] text-ink-500">No approved fixed-overhead payments in this selection.</p>
              )}
              {fixedCostHeadRows.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-base-800 py-1 text-xs">
                  <span className="text-ink-300">{k}</span>
                  <span className="font-medium text-ink-50">{usd(v)}</span>
                </div>
              ))}
            </div>
            <div>
              <h4 className="mb-1.5 text-xs font-medium text-ink-50">
                {fixedDept === "all" ? "Department comparison" : "Monthly payments"}
              </h4>
              {fixedRightRows.length === 0 && (
                <p className="text-[11px] text-ink-500">Nothing classified as fixed in this selection.</p>
              )}
              {fixedRightRows.map(([k, v]) => (
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
            {worstOverMonth ? `${mo(worstOverMonth.month)} overspent ${usd(worstOverMonth.variance ?? 0)}` : "Set monthly budget controls"}
          </h4>
          <p className="mt-1 text-xs text-ink-500">
            {worstOverMonth
              ? "Review the individual transactions in the worst month before approving next year's spend. Identify exceptional expenses and ongoing run-rate increases."
              : "Make each cost head owner accountable for monthly budget utilisation."}
          </p>
          <Link href="/finance/budget" className="mt-3 inline-block rounded-lg border border-base-700 bg-base-800 px-2.5 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50">
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
          <Link href="/finance/needs-allocation" className="mt-3 inline-block rounded-lg border border-base-700 bg-base-800 px-2.5 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50">
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
          <Link href="/finance/historical-debt" className="mt-3 inline-block rounded-lg border border-base-700 bg-base-800 px-2.5 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50">
            See historical debt →
          </Link>
        </div>
      </div>

      <div className="mt-5 text-[11px] text-ink-500">
        Initial dataset: November 2025 to July 2026. New months are included automatically after import. Any
        financial-year budget that has not been supplied is labelled unavailable, rather than assumed.
      </div>
    </div>
  );
}
