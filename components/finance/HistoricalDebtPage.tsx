"use client";

import { useMemo, useState } from "react";
import { useFilteredFinanceRows } from "./FinanceFilterContext";
import type { FinanceState } from "@/lib/finance/ledgerData";

// Direct structural/content port of the source app's debtPage() (server
// render function, index.html line 1041) — same 4 KPI cards (same titles/
// formulas/detail copy), same split panel (debt paid by month / original
// cost heads of debt payments, both clickable row-metrics that drill the
// table below), same notice paragraph verbatim, then the full debt
// transactions table sorted by amount descending. Only the visual
// implementation (Tailwind table/cards) replaces the original's bespoke
// CSS — this is a re-skin, not a redesign.

function usd(value: number, compact = false): string {
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
  color?: "purple" | "amber";
}) {
  const colorClass = color === "purple" ? "text-[#7965bd]" : color === "amber" ? "text-status-alert" : "text-ink-50";
  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <h4 className="text-[11px] text-ink-500">{title}</h4>
      <div className={`mt-1 text-xl font-semibold ${colorClass}`}>{value}</div>
      <div className="mt-1 text-[11px] text-ink-500">{detail}</div>
    </div>
  );
}

const PERIOD_LABEL: Record<string, string> = { "2024-25": "Historical 2024/25", older: "Historical older" };
const PERIOD_BADGE: Record<string, string> = {
  "2024-25": "bg-status-inactive/15 text-status-inactive",
  older: "bg-[#7965bd]/15 text-[#7965bd]",
};

export function HistoricalDebtPage({ state: rawState }: { state: FinanceState }) {
  // Scoped by the global Finance filter bar — debtPage() in the source app
  // calls filt() first, exactly like this.
  const state = { ...rawState, transactions: useFilteredFinanceRows(rawState.transactions) };
  const [monthFilter, setMonthFilter] = useState<string | null>(null);
  const [headFilter, setHeadFilter] = useState<string | null>(null);

  const t = useMemo(() => state.transactions.filter((x) => x.debtPeriod !== "current"), [state.transactions]);
  const year = useMemo(() => t.filter((x) => x.debtPeriod === "2024-25"), [t]);
  const older = useMemo(() => t.filter((x) => x.debtPeriod === "older"), [t]);

  const heads = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of t) {
      const h = x.managementDepartment || "Unallocated";
      m.set(h, (m.get(h) ?? 0) + x.amount);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [t]);

  const months = state.monthly.map((m) => m.month);

  const sum = (rows: typeof t) => rows.reduce((s, x) => s + x.amount, 0);

  const table = useMemo(() => {
    let rows = t;
    if (monthFilter) rows = rows.filter((x) => x.month === monthFilter);
    if (headFilter) rows = rows.filter((x) => (x.managementDepartment || "Unallocated") === headFilter);
    return rows.slice().sort((a, b) => b.amount - a.amount);
  }, [t, monthFilter, headFilter]);

  const activeFilter = monthFilter ? `Month: ${mo(monthFilter)}` : headFilter ? `Head: ${headFilter}` : null;

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-50">Historical debt servicing</h1>
        <p className="mt-1 text-sm text-ink-500">
          Payments made this FY that settle previous years&rsquo; obligations, without changing the original cost
          head or payment date.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title="Prior-year obligations cleared"
          value={usd(sum(t), true)}
          detail={`${t.length} payments marked`}
          color="purple"
        />
        <Kpi title="FY2024/25 liabilities" value={usd(sum(year), true)} detail={`${year.length} payments tagged as last year`} />
        <Kpi title="Older obligations" value={usd(sum(older), true)} detail={`${older.length} payments tagged as older`} />
        <Kpi
          title="Remaining old debt"
          value="Unknown"
          detail="The original file does not include outstanding payable balances"
          color="amber"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-base-700 bg-base-900 p-4">
          <h3 className="mb-2 text-sm font-medium text-ink-50">Historical debt paid, by month</h3>
          {months.map((x) => (
            <button
              key={x}
              onClick={() => {
                setHeadFilter(null);
                setMonthFilter(monthFilter === x ? null : x);
              }}
              className={`flex w-full items-center justify-between border-b border-base-800 py-1.5 text-left text-xs last:border-0 ${
                monthFilter === x ? "text-ink-50" : "text-ink-300 hover:text-ink-50"
              }`}
            >
              <strong>{mo(x)}</strong>
              <b>{usd(sum(t.filter((z) => z.month === x)))}</b>
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-base-700 bg-base-900 p-4">
          <h3 className="mb-2 text-sm font-medium text-ink-50">Original cost heads of debt payments</h3>
          {heads.length === 0 && (
            <p className="text-[11px] text-ink-500">Classify any payment as historical debt to build this view.</p>
          )}
          {heads.map(([h, a]) => (
            <button
              key={h}
              onClick={() => {
                setMonthFilter(null);
                setHeadFilter(headFilter === h ? null : h);
              }}
              className={`flex w-full items-center justify-between border-b border-base-800 py-1.5 text-left text-xs last:border-0 ${
                headFilter === h ? "text-ink-50" : "text-ink-300 hover:text-ink-50"
              }`}
            >
              <strong>{h}</strong>
              <b>{usd(a)}</b>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-base-700 bg-base-900 p-4 text-xs text-ink-300">
        Historical debt servicing here means a payment made this year against a previous year&rsquo;s obligation. It
        is not automatically interest or bank borrowing. The recorded cash payment stays in the ledger and is
        excluded only from the current-year operating spend metric.
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-ink-50">Historical debt payments</h3>
          {activeFilter && (
            <button
              onClick={() => {
                setMonthFilter(null);
                setHeadFilter(null);
              }}
              className="rounded-full border border-base-700 px-2 py-0.5 text-[11px] text-ink-300 hover:text-ink-50"
            >
              {activeFilter} ×
            </button>
          )}
        </div>
        <div className="overflow-x-auto rounded-xl border border-base-700">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-base-700 bg-base-900 text-ink-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Payee / payment description</th>
                <th className="px-3 py-2">Department / cost head</th>
                <th className="px-3 py-2 text-right">USD</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Review</th>
              </tr>
            </thead>
            <tbody>
              {table.map((x) => (
                <tr key={x.id} className="border-b border-base-800 text-ink-300 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2">{new Date(x.date).toLocaleDateString()}</td>
                  <td className="max-w-[320px] truncate px-3 py-2 text-ink-50" title={x.description}>
                    {x.description}
                  </td>
                  <td className="px-3 py-2">
                    {x.managementDepartment ?? <span className="text-ink-500">Unallocated</span>}
                    <div className="text-[11px] text-ink-500">{x.managementCostHead ?? "Needs allocation"}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-ink-50">{usd(x.amount)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        PERIOD_BADGE[x.debtPeriod] ?? "bg-status-alert/15 text-status-alert"
                      }`}
                    >
                      {PERIOD_LABEL[x.debtPeriod] ?? x.debtPeriod}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {x.reviewed ? (
                      <span className="rounded-full bg-status-active/15 px-2 py-0.5 text-[11px] font-medium text-status-active">
                        Reviewed
                      </span>
                    ) : (
                      <span className="rounded-full bg-base-800 px-2 py-0.5 text-[11px] text-ink-300">Recorded</span>
                    )}
                  </td>
                </tr>
              ))}
              {table.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-ink-500">
                    No payments match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
