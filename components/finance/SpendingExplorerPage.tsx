"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BulkPaymentToolbar } from "./BulkPaymentToolbar";
import { PaymentsTable } from "./PaymentsTable";
import { ClassifyModal } from "./ClassifyModal";
import { DonutWidget } from "./DonutWidget";
import { ChartPicker, selectionAllows } from "./ChartPicker";
import { useFilteredFinanceRows, useFinanceFilters } from "./FinanceFilterContext";
import { effectiveCentre, effectiveHead, hasCostSplit, isOperating, reportingRows } from "@/lib/finance/financeReporting";
import type { FinanceLedgerRow, FinanceState } from "@/lib/finance/ledgerData";

// Port of the source spendingExplorer(): department -> cost head -> description drill, URL-driven.

type Basis = "operating" | "all" | "debt";

function usd(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (compact && Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `${value < 0 ? "-" : ""}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

function groupCosts(tx: FinanceLedgerRow[], fn: (t: FinanceLedgerRow) => string) {
  const m = new Map<string, { key: string; value: number; count: number }>();
  for (const t of tx) {
    const key = String(fn(t) || "Not specified");
    const it = m.get(key) ?? { key, value: 0, count: 0 };
    it.value += Number(t.amount) || 0;
    it.count += 1;
    m.set(key, it);
  }
  return Array.from(m.values()).sort((a, b) => b.value - a.value);
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

const belongsToDepartment = (t: FinanceLedgerRow, d: string) =>
  hasCostSplit(t) ? t.departmentSplits.some((x) => x.department === d) : effectiveHead(t) === d;
const belongsToCostHead = (t: FinanceLedgerRow, h: string) =>
  hasCostSplit(t) ? t.departmentSplits.some((x) => x.costHead === h) : effectiveCentre(t) === h;

export function SpendingExplorerPage({ state }: { state: FinanceState }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { filters } = useFinanceFilters();
  const filtered = useFilteredFinanceRows(state.transactions);
  const [rows, setRows] = useState(filtered);
  useEffect(() => setRows(filtered), [filtered]);

  const [basis, setBasis] = useState<Basis>("operating");
  const [selectedHeads, setSelectedHeads] = useState<Set<string> | null>(null);
  const [selectedCentres, setSelectedCentres] = useState<Set<string> | null>(null);
  const [paySelected, setPaySelected] = useState<Set<string>>(new Set());
  const [pageIds, setPageIds] = useState<string[]>([]);
  const [detail, setDetail] = useState<FinanceLedgerRow | null>(null);

  const h = searchParams.get("department") || (filters.department !== "all" ? filters.department : null);
  const c = searchParams.get("centre");
  useEffect(() => {
    setSelectedCentres(null);
    setPaySelected(new Set());
  }, [h, c]);

  const go = (department: string | null, centre: string | null = null) => {
    const p = new URLSearchParams(searchParams.toString());
    p.delete("department");
    p.delete("centre");
    if (department) p.set("department", department);
    if (centre) p.set("centre", centre);
    const qs = p.toString();
    router.push(qs ? `/finance/explorer?${qs}` : "/finance/explorer");
  };

  const base = useMemo(() => {
    if (basis === "operating") return rows.filter((t) => isOperating(t, state.departments));
    if (basis === "debt") return rows.filter((t) => t.debtPeriod !== "current");
    return rows;
  }, [rows, basis, state.departments]);
  const reportBase = useMemo(() => reportingRows(base, filters.department), [base, filters.department]);

  const stage: "head" | "centre" | "description" = c ? "description" : h ? "centre" : "head";
  const choices = useMemo(
    () => groupCosts(h ? reportBase.filter((t) => effectiveHead(t) === h) : reportBase, h ? effectiveCentre : effectiveHead),
    [reportBase, h]
  );
  const selected = stage === "head" ? selectedHeads : stage === "centre" ? selectedCentres : null;

  const tx = useMemo(() => {
    let out = base;
    if (h) out = out.filter((t) => belongsToDepartment(t, h));
    if (c) out = out.filter((t) => belongsToCostHead(t, c));
    else if (!h)
      out = out.filter((t) =>
        hasCostSplit(t) ? t.departmentSplits.some((x) => selectionAllows(selectedHeads, x.department)) : selectionAllows(selectedHeads, effectiveHead(t))
      );
    else
      out = out.filter((t) =>
        hasCostSplit(t) ? t.departmentSplits.some((x) => selectionAllows(selectedCentres, x.costHead)) : selectionAllows(selectedCentres, effectiveCentre(t))
      );
    const dateKey = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
    return [...out].sort((a, b) => b.month.localeCompare(a.month) || dateKey(b.date).localeCompare(dateKey(a.date)) || b.amount - a.amount);
  }, [base, h, c, selectedHeads, selectedCentres]);

  const displayed = reportBase.filter(
    (t) =>
      (!h || effectiveHead(t) === h) &&
      (!c || effectiveCentre(t) === c) &&
      (!c && !h ? selectionAllows(selectedHeads, effectiveHead(t)) : !c ? selectionAllows(selectedCentres, effectiveCentre(t)) : true)
  );
  const groups = groupCosts(displayed, stage === "head" ? effectiveHead : stage === "centre" ? effectiveCentre : (x) => x.description);
  const all = displayed.reduce((s, t) => s + t.amount, 0);
  const baseAmount = (h ? reportBase.filter((t) => effectiveHead(t) === h) : reportBase).reduce((s, t) => s + t.amount, 0);
  const percent = baseAmount > 0 ? `${((100 * all) / baseAmount).toFixed(1)}%` : "Not available";
  const label = stage === "head" ? "Cost heads" : stage === "centre" ? `Cost heads within ${h}` : `Payment descriptions within ${c}`;
  const headOptions = Array.from(new Set(filtered.map(effectiveHead))).sort();
  const browseNote =
    basis === "operating"
      ? "Classified current-year spending, excluding historical debt and unresolved movements"
      : basis === "debt"
        ? "Payments marked as historical debt"
        : "All recorded payments, including movements that may not be expenses";
  const selectedCount = selected === null ? choices.length : choices.filter((g) => selected.has(g.key)).length;
  const budgetNote =
    stage === "head" && basis === "operating" && filters.department === "all" && filters.country === "all" && !filters.query && selectedHeads === null
      ? "The separate Budget vs Actual page shows the full operating budget. Use that page to assess overall budget variance."
      : "The source does not allocate budgets to individual cost heads or cost centres. A reliable over/under-budget comparison is unavailable for this custom selection.";

  const modeParam = basis === "operating" ? "operating" : basis === "debt" ? "debt" : "all";
  const hrefFor = (name: string) =>
    stage === "head"
      ? `/finance/explorer?department=${encodeURIComponent(name)}`
      : stage === "centre"
        ? `/finance/explorer?department=${encodeURIComponent(h!)}&centre=${encodeURIComponent(name)}`
        : `/finance/payments?mode=${modeParam}&department=${encodeURIComponent(h!)}&costHead=${encodeURIComponent(c!)}&description=${encodeURIComponent(name)}`;
  const ledgerHref = `/finance/payments?mode=${modeParam}${h ? `&department=${encodeURIComponent(h)}` : ""}${c ? `&costHead=${encodeURIComponent(c)}` : ""}`;
  const listCap = stage === "description" ? 15 : 45;

  const fieldLabel = "flex flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-ink-500";
  const fieldSelect = "rounded-lg border border-base-700 bg-base-800 px-2.5 py-2 text-xs normal-case tracking-normal text-ink-50 outline-none";

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-ink-50">What is the money actually being spent on?</h2>
        <p className="mt-1 text-sm text-ink-500">
          Select multiple departments or cost centres using checkboxes, then drill down to the payments behind them. All
          figures respond to your month, country and payment filters.
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className={fieldLabel}>
          Payment view
          <select
            value={basis}
            onChange={(e) => {
              setBasis(e.target.value as Basis);
              setPaySelected(new Set());
            }}
            className={fieldSelect}
          >
            <option value="operating">Current-year operating costs</option>
            <option value="all">All ledger payments</option>
            <option value="debt">Historical debt only</option>
          </select>
        </label>
        <label className={fieldLabel}>
          Open a department
          <select value={h ?? "all"} onChange={(e) => go(e.target.value === "all" ? null : e.target.value)} className={fieldSelect}>
            <option value="all">All available cost heads</option>
            {headOptions.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => go(null)} className="rounded-lg border border-base-700 px-3 py-2 text-xs text-ink-300 hover:text-ink-50">
          View all cost heads
        </button>
      </div>

      <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-xs">
        <button onClick={() => go(null)} className={h ? "text-status-active hover:underline" : "font-medium text-status-active"}>
          All cost heads
        </button>
        {h && (
          <>
            <span className="text-ink-500">›</span>
            <button onClick={() => go(h)} className={c ? "text-status-active hover:underline" : "font-medium text-ink-50"}>
              {h}
            </button>
          </>
        )}
        {c && (
          <>
            <span className="text-ink-500">›</span>
            <span className="font-medium text-ink-50">{c}</span>
          </>
        )}
      </nav>

      {stage === "head" && (
        <ChartPicker title="Select departments" rows={choices} selected={selectedHeads} onChange={setSelectedHeads} />
      )}
      {stage === "centre" && (
        <ChartPicker title={`Select cost heads in ${h}`} rows={choices} selected={selectedCentres} onChange={setSelectedCentres} />
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Selected expenditure" value={usd(all, true)} detail={browseNote} />
        <Kpi title="Payments in selection" value={tx.length.toLocaleString()} detail="Individual source entries in this selection" />
        <Kpi
          title={stage === "description" ? "Payment descriptions" : "Entries selected"}
          value={stage === "description" ? groups.length.toLocaleString() : `${selectedCount} / ${choices.length}`}
          detail={stage === "description" ? "Distinct transaction descriptions" : "Use the checkboxes above to adjust this comparison"}
        />
        <Kpi title={`Share of ${h ? "department" : "filtered total"}`} value={percent} detail="Share of the available signed net spend" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-base-700 bg-base-900 p-4 lg:col-span-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-ink-50">{label}</h3>
            <span className="rounded-full bg-base-800 px-2 py-0.5 text-[11px] text-ink-300">Updates as you tick entries</span>
          </div>
          <p className="mb-3 text-[11px] text-ink-500">
            Doughnut proportions represent positive net costs. Click a coloured slice or legend entry for an individual
            drilldown.
          </p>
          <DonutWidget
            wide
            rows={groups.map((g) => ({ name: g.key, value: g.value, count: g.count }))}
            otherLabel={stage === "head" ? "Other heads" : stage === "centre" ? "Other cost centres" : "Other payments"}
            hrefFor={hrefFor}
          />
        </div>
        <div className="rounded-xl border border-base-700 bg-base-900 p-4 lg:col-span-2">
          <h3 className="text-sm font-medium text-ink-50">
            {stage === "head" ? "Selected departments" : stage === "centre" ? "Selected cost heads" : "Largest payment descriptions"}
          </h3>
          <p className="mb-3 mt-1 text-[11px] text-ink-500">These amounts use signed net ledger figures and may include adjustments or credits.</p>
          <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
            {groups.slice(0, listCap).map((g) => (
              <Link
                key={g.key}
                href={hrefFor(g.key)}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-base-800"
              >
                <span className="min-w-0">
                  <strong className="block truncate text-ink-50">{g.key}</strong>
                  <small className="text-[10px] text-ink-500">{g.count} payments</small>
                </span>
                <span className="shrink-0 font-semibold text-ink-50">{usd(g.value, true)} ↗</span>
              </Link>
            ))}
            {groups.length === 0 && <p className="py-4 text-center text-xs text-ink-500">Nothing selected. Tick one or more checkboxes above.</p>}
          </div>
          {groups.length > listCap && (
            <p className="mt-2 text-[11px] text-ink-500">{groups.length - listCap} additional items remain visible in the ledger.</p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <BulkPaymentToolbar
          mode="explorer"
          tx={tx}
          pageIds={pageIds}
          selected={paySelected}
          setSelected={setPaySelected}
          departments={state.departments}
          managementCostHeads={state.managementCostHeads}
          onApplied={(ids, dept, costHead) => {
            setRows((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, managementDepartment: dept, managementCostHead: costHead } : r)));
            setPaySelected(new Set());
          }}
        />
      </div>

      <div className="rounded-xl border border-base-700 bg-base-900 p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-ink-50">Payments behind {c || h || "your selected cost heads"}</h3>
          <Link href={ledgerHref} className="rounded-lg border border-base-700 px-2.5 py-1 text-[11px] text-ink-300 hover:text-ink-50">
            Open these payments in full ledger ↗
          </Link>
        </div>
        <p className="mb-3 text-[11px] text-ink-500">
          Tick individual payments below, or use Select all filtered above to reclassify every matching payment across
          pages. Chart category checkboxes filter the view; payment checkboxes select actual records to change.
        </p>
        <PaymentsTable
          rows={tx}
          selectable
          selected={paySelected}
          onToggle={(id) =>
            setPaySelected((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          onToggleAllPage={(ids, on) =>
            setPaySelected((prev) => {
              const next = new Set(prev);
              ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
              return next;
            })
          }
          onPageIdsChange={setPageIds}
          onRowClick={setDetail}
        />
      </div>

      <div className="mt-4 rounded-lg border border-status-alert/30 bg-status-alert/10 px-3 py-2 text-[11px] text-status-alert">
        {budgetNote} Certain ledger entries may be transfers, refunds or collections, not genuine expenditure. Confirm the
        accounting treatment before making management decisions.
      </div>

      {detail && (
        <ClassifyModal
          transaction={detail}
          departments={state.departments}
          managementCostHeads={state.managementCostHeads}
          costHeads={state.costHeads}
          onClose={() => setDetail(null)}
          onSaved={({ department, costHead }) => {
            setRows((prev) =>
              prev.map((r) => (r.id === detail.id ? { ...r, managementDepartment: department, managementCostHead: costHead } : r))
            );
            setDetail(null);
          }}
        />
      )}
    </div>
  );
}
