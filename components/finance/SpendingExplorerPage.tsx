"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { BulkPaymentToolbar } from "./BulkPaymentToolbar";
import { useFilteredFinanceRows } from "./FinanceFilterContext";
import type { FinanceLedgerRow, FinanceState } from "@/lib/finance/ledgerData";

// Direct structural/content port of the source app's Spending Explorer
// screen — same header copy, same payment-view basis switch, same
// department jump-to, same 3-level drill (department -> cost centre ->
// payment description) with a checkbox multi-select for filtering and a
// clickable ranked list for drilling, same 4 KPI cards, same payments
// table and closing caveat. Only the visual implementation (WidgetCard /
// recharts / Tailwind) replaces the original's bespoke CSS/SVG.

const DONUT_COLORS = ["#14b8a6", "#ef4444", "#f59e0b", "#d4af37", "#9ca3af", "#7965bd", "#60a5fa", "#fb923c"];
const UNCLASSIFIED_DEPT = "Unclassified";
const UNLABELLED_CENTRE = "Unlabelled cost centre";

type PaymentView = "operating" | "all" | "debt";

const PAYMENT_VIEW_OPTIONS: { value: PaymentView; label: string }[] = [
  { value: "operating", label: "Current-year operating costs" },
  { value: "all", label: "All ledger payments" },
  { value: "debt", label: "Historical debt only" },
];

function usd(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (compact && Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${Math.round(value).toLocaleString()}`;
}

type GroupRow = { name: string; value: number; count: number };

function groupTransactions(rows: FinanceLedgerRow[], keyFn: (t: FinanceLedgerRow) => string): GroupRow[] {
  const map = new Map<string, { value: number; count: number }>();
  for (const t of rows) {
    const key = keyFn(t);
    const entry = map.get(key) ?? { value: 0, count: 0 };
    entry.value += t.amount;
    entry.count += 1;
    map.set(key, entry);
  }
  return Array.from(map.entries())
    .map(([name, { value, count }]) => ({ name, value, count }))
    .sort((a, b) => b.value - a.value);
}

function Kpi({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <h4 className="text-[11px] text-ink-500">{title}</h4>
      <div className="mt-1 text-xl font-semibold text-ink-50">{value}</div>
      <div className="mt-1 text-[11px] text-ink-500">{detail}</div>
    </div>
  );
}

export function SpendingExplorerPage({ state: rawState }: { state: FinanceState }) {
  // Scoped by the global Finance filter bar — spendingExplorer() in the
  // source app calls filt() first, exactly like this.
  const state = { ...rawState, transactions: useFilteredFinanceRows(rawState.transactions) };
  const [rows, setRows] = useState(state.transactions);
  useEffect(() => {
    setRows(state.transactions);
  }, [state.transactions]);
  const [paymentView, setPaymentView] = useState<PaymentView>("operating");
  const [department, setDepartment] = useState<string | null>(null);
  const [centre, setCentre] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(new Set());

  const activeDepartments = useMemo(() => new Set(state.departments), [state.departments]);
  const isOperating = (t: FinanceLedgerRow) =>
    Boolean(t.managementDepartment) && activeDepartments.has(t.managementDepartment!) && t.debtPeriod === "current";

  const basisTransactions = useMemo(() => {
    if (paymentView === "operating") return rows.filter(isOperating);
    if (paymentView === "debt") return rows.filter((t) => t.debtPeriod !== "current");
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, paymentView, activeDepartments]);

  const deptKey = (t: FinanceLedgerRow) => t.managementDepartment ?? UNCLASSIFIED_DEPT;
  const centreKey = (t: FinanceLedgerRow) => t.effectiveCentre ?? UNLABELLED_CENTRE;
  const descKey = (t: FinanceLedgerRow) => t.description || "(no description)";

  const scoped = useMemo(() => {
    let out = basisTransactions;
    if (department) out = out.filter((t) => deptKey(t) === department);
    if (department && centre) out = out.filter((t) => centreKey(t) === centre);
    return out;
  }, [basisTransactions, department, centre]);

  const level = !department ? 0 : !centre ? 1 : 2;
  const levelKeyFn = level === 0 ? deptKey : level === 1 ? centreKey : descKey;

  const grouped = useMemo(() => groupTransactions(scoped, levelKeyFn), [scoped, level]);
  const rankedCap = level === 2 ? 15 : 45;

  const departmentOptions = useMemo(
    () => groupTransactions(basisTransactions, deptKey).map((g) => g.name),
    [basisTransactions]
  );

  function resetAll() {
    setDepartment(null);
    setCentre(null);
    setSelected(new Set());
  }

  function goToDepartment(name: string) {
    setDepartment(name);
    setCentre(null);
    setSelected(new Set());
  }

  function goToCentre(name: string) {
    setCentre(name);
    setSelected(new Set());
  }

  function handleRowClick(name: string) {
    if (level === 0) goToDepartment(name);
    else if (level === 1) goToCentre(name);
    else toggle(name);
  }

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const activeFilter = selected.size > 0;
  const filteredTransactions = useMemo(() => {
    if (!activeFilter) return scoped;
    return scoped.filter((t) => selected.has(levelKeyFn(t)));
  }, [scoped, selected, activeFilter, level]);

  const selectedTotal = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
  const scopedTotal = scoped.reduce((sum, t) => sum + t.amount, 0);
  const sharePct = scopedTotal > 0 ? (selectedTotal / scopedTotal) * 100 : 0;
  const expenditureNote =
    paymentView === "operating"
      ? "Classified current-year spending, excluding historical debt and unresolved movements"
      : paymentView === "debt"
      ? "Payments marked as historical debt"
      : "All recorded payments, including movements that may not be expenses";
  const paymentPageIds = filteredTransactions.slice(0, 200).map((t) => t.id);

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-ink-50">What is the money actually being spent on?</h2>
        <p className="mt-1 text-sm text-ink-500">
          Select multiple departments or cost centres using checkboxes, then drill down to the payments behind
          them. All figures respond to your month, country and payment filters.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-ink-500">
          Payment view
          <select
            value={paymentView}
            onChange={(e) => {
              setPaymentView(e.target.value as PaymentView);
              resetAll();
            }}
            className="rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs text-ink-50 outline-none"
          >
            {PAYMENT_VIEW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-ink-500">
          Open a department
          <select
            value={department ?? ""}
            onChange={(e) => (e.target.value ? goToDepartment(e.target.value) : resetAll())}
            className="rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs text-ink-50 outline-none"
          >
            <option value="">Choose a department…</option>
            {departmentOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={resetAll}
          className="rounded-lg border border-base-700 px-3 py-1.5 text-xs text-ink-300 hover:text-ink-50"
        >
          View all cost heads
        </button>
      </div>

      <nav className="mb-4 flex flex-wrap items-center gap-1 text-xs">
        <button
          onClick={resetAll}
          className={department ? "text-ink-300 hover:text-ink-50" : "font-medium text-ink-50"}
        >
          All cost heads
        </button>
        {department && (
          <>
            <span className="text-ink-600">›</span>
            <button
              onClick={() => {
                setCentre(null);
                setSelected(new Set());
              }}
              className={centre ? "text-ink-300 hover:text-ink-50" : "font-medium text-ink-50"}
            >
              {department}
            </button>
          </>
        )}
        {department && centre && (
          <>
            <span className="text-ink-600">›</span>
            <span className="font-medium text-ink-50">{centre}</span>
          </>
        )}
      </nav>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Selected expenditure" value={usd(selectedTotal, true)} detail={expenditureNote} />
        <Kpi title="Payments in selection" value={filteredTransactions.length.toLocaleString()} detail="Individual ledger rows" />
        {level < 2 ? (
          <Kpi
            title="Entries selected"
            value={`${selected.size} / ${grouped.length}`}
            detail="Use the checkboxes above to adjust this comparison"
          />
        ) : (
          <Kpi title="Payment descriptions" value={String(grouped.length)} detail="Distinct descriptions at this level" />
        )}
        <Kpi
          title={department ? "Share of department total" : "Share of filtered total"}
          value={`${sharePct.toFixed(1)}%`}
          detail="Share of the available signed net spend"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <WidgetCard
          title={level === 0 ? "Cost heads" : level === 1 ? `Cost heads within ${department}` : `Payment descriptions within ${centre}`}
          className="lg:col-span-3"
          action={
            <span className="rounded-full bg-base-800 px-2 py-0.5 text-[11px] text-ink-300">
              Updates as you tick entries
            </span>
          }
        >
          <p className="mb-3 text-xs text-ink-500">
            Doughnut proportions represent positive net costs. Click a coloured slice or legend entry for an
            individual drilldown.
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={grouped}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={1}
                onClick={(entry: any) => entry?.name && toggle(entry.name)}
                cursor="pointer"
              >
                {grouped.map((entry, i) => (
                  <Cell
                    key={entry.name}
                    fill={DONUT_COLORS[i % DONUT_COLORS.length]}
                    opacity={!activeFilter || selected.has(entry.name) ? 1 : 0.25}
                    stroke="#111113"
                    strokeWidth={1}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#1a1a1d", border: "1px solid #232327", fontSize: 11 }}
                formatter={(value, name) => [usd(Number(value ?? 0)), String(name)]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 flex max-h-[160px] flex-col gap-1 overflow-y-auto">
            {grouped.map((g, i) => {
              const checked = selected.has(g.name);
              return (
                <label
                  key={g.name}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1 text-xs hover:bg-base-800"
                >
                  <span className="flex items-center gap-2 text-ink-300">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(g.name)}
                      className="h-3.5 w-3.5 rounded border-base-600 bg-base-800 accent-status-active"
                    />
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    {g.name}
                  </span>
                  <span className="shrink-0 text-ink-500">{usd(g.value)}</span>
                </label>
              );
            })}
          </div>
        </WidgetCard>

        <WidgetCard
          title={level === 0 ? "Selected departments" : level === 1 ? "Selected cost heads" : "Largest payment descriptions"}
          className="lg:col-span-2"
          action={
            <span className="rounded-full bg-base-800 px-2 py-0.5 text-[11px] text-ink-300">
              {level < 2 ? "Click a row to drill down" : "Click a row to filter"}
            </span>
          }
        >
          <p className="mb-3 text-xs text-ink-500">
            These amounts use signed net ledger figures and may include adjustments or credits.
          </p>
          <div className="flex max-h-[320px] flex-col gap-1 overflow-y-auto">
            {grouped.slice(0, rankedCap).map((g) => (
              <button
                key={g.name}
                onClick={() => handleRowClick(g.name)}
                className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-base-800 ${
                  level === 2 && selected.has(g.name) ? "bg-base-800" : ""
                }`}
              >
                <span className="truncate text-ink-300">{g.name}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-ink-500">{g.count} pmts</span>
                  <span className="font-medium text-ink-50">{usd(g.value)}</span>
                </span>
              </button>
            ))}
            {grouped.length === 0 && <p className="p-2 text-xs text-ink-500">No payments at this level.</p>}
          </div>
          {grouped.length > rankedCap && (
            <p className="mt-2 text-[11px] text-ink-500">
              {(grouped.length - rankedCap).toLocaleString()} additional items remain visible in the ledger.
            </p>
          )}
        </WidgetCard>
      </div>

      <p className="mt-4 text-xs text-ink-500">
        Tick individual payments below, or use Select all filtered above to reclassify every matching payment across
        pages. Chart category checkboxes filter the view; payment checkboxes select actual records to change.
      </p>

      <BulkPaymentToolbar
        mode="payments"
        tx={filteredTransactions}
        pageIds={paymentPageIds}
        selected={selectedPaymentIds}
        setSelected={setSelectedPaymentIds}
        departments={state.departments}
        managementCostHeads={state.managementCostHeads}
        onApplied={(ids, dept, costHead) => {
          setRows((prev) =>
            prev.map((r) => (ids.includes(r.id) ? { ...r, managementDepartment: dept, managementCostHead: costHead } : r))
          );
          setSelectedPaymentIds(new Set());
        }}
      />

      <div className="mt-4">
        <WidgetCard
          title={`Payments behind ${centre ?? department ?? "your selected cost heads"}`}
          action={
            <Link
              href={department ? `/finance/payments?department=${encodeURIComponent(department)}` : "/finance/payments"}
              className="text-[11px] text-ink-300 hover:text-ink-50"
            >
              Open these payments in full ledger ↗
            </Link>
          }
        >
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.slice(0, 200).map((t) => (
                  <tr key={t.id} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="px-3 py-1.5">{new Date(t.date).toLocaleDateString()}</td>
                    <td className="max-w-[320px] truncate px-3 py-1.5" title={t.description}>
                      {t.description}
                    </td>
                    <td className="px-3 py-1.5">
                      {t.managementDepartment ?? (
                        <span className="rounded-full bg-status-alert/15 px-2 py-0.5 text-[11px] font-medium text-status-alert">
                          {UNCLASSIFIED_DEPT}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right">{usd(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredTransactions.length === 0 && (
              <p className="p-4 text-center text-xs text-ink-500">No payments match the current selection.</p>
            )}
            {filteredTransactions.length > 200 && (
              <p className="border-t border-base-800 p-2 text-center text-[11px] text-ink-500">
                Showing first 200 of {filteredTransactions.length.toLocaleString()} matching payments.
              </p>
            )}
          </div>
        </WidgetCard>
      </div>

      <div className="mt-4 rounded-lg border border-status-alert/30 bg-status-alert/10 px-3 py-2 text-[11px] text-status-alert">
        {level === 0 && paymentView === "operating" && !activeFilter ? (
          "The separate Budget vs Actual page shows the full operating budget. Use that page to assess overall budget variance."
        ) : (
          <>
            Budget comparisons are not available for a custom cost-head or cost-centre selection like this one — the
            operating budget is only defined by month and department. Some ledger entries shown here may be
            transfers, refunds or collections rather than genuine expenditure, and should be read with that in mind.
          </>
        )}
      </div>
    </div>
  );
}
