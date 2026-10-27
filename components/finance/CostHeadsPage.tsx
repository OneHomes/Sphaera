"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useFilteredFinanceRows, useFinanceFilters } from "./FinanceFilterContext";
import { DonutWidget } from "./DonutWidget";
import { ChartPicker, selectionAllows } from "./ChartPicker";
import { useTablePager } from "./TablePager";
import { effectiveCentre, effectiveHead, isOperating } from "@/lib/finance/financeReporting";
import type { FinanceState } from "@/lib/finance/ledgerData";

// Port of the source headPage().

function usd(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (compact && Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `${value < 0 ? "-" : ""}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

function Kpi({ title, value, detail, purple, href }: { title: string; value: string; detail: string; purple?: boolean; href: string }) {
  return (
    <Link href={href} className="relative block rounded-xl border border-base-700 bg-base-900 p-4 transition hover:border-base-600">
      <span className="absolute right-3 top-3 text-xs text-ink-500">↗</span>
      <h4 className="pr-4 text-[11px] text-ink-500">{title}</h4>
      <div className={`mt-1 text-xl font-semibold ${purple ? "text-[#8167b8]" : "text-ink-50"}`}>{value}</div>
      <div className="mt-1 text-[11px] text-ink-500">{detail}</div>
    </Link>
  );
}

const explorerHref = (department: string, centre?: string) =>
  `/finance/explorer?department=${encodeURIComponent(department)}${centre ? `&centre=${encodeURIComponent(centre)}` : ""}`;

export function CostHeadsPage({ state: rawState }: { state: FinanceState }) {
  const source = useFilteredFinanceRows(rawState.transactions);
  const { filters } = useFinanceFilters();
  const [selectedHeads, setSelectedHeads] = useState<Set<string> | null>(null);

  const pickerRows = useMemo(() => {
    const m = new Map<string, { value: number; count: number }>();
    for (const t of source) {
      const k = effectiveHead(t);
      const e = m.get(k) ?? { value: 0, count: 0 };
      e.value += t.amount;
      e.count += 1;
      m.set(k, e);
    }
    return Array.from(m.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.value - a.value);
  }, [source]);

  const tx = useMemo(() => source.filter((t) => selectionAllows(selectedHeads, effectiveHead(t))), [source, selectedHeads]);

  const list = useMemo(() => {
    const by = new Map<string, { total: number; debt: number; count: number; cent: Map<string, number> }>();
    for (const t of tx) {
      const head = effectiveHead(t);
      const h = by.get(head) ?? { total: 0, debt: 0, count: 0, cent: new Map<string, number>() };
      h.total += t.amount;
      h.count += 1;
      if (t.debtPeriod !== "current") h.debt += t.amount;
      h.cent.set(effectiveCentre(t), (h.cent.get(effectiveCentre(t)) ?? 0) + t.amount);
      by.set(head, h);
    }
    return Array.from(by.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [tx]);

  const byCentre = filters.department !== "all";
  const donutRows = useMemo(() => {
    const m = new Map<string, { value: number; count: number }>();
    for (const t of tx) {
      const k = byCentre ? effectiveCentre(t) : effectiveHead(t);
      const e = m.get(k) ?? { value: 0, count: 0 };
      e.value += t.amount;
      e.count += 1;
      m.set(k, e);
    }
    return Array.from(m.entries()).map(([name, v]) => ({ name, ...v }));
  }, [tx, byCentre]);

  const { pageRows, pager } = useTablePager(list);
  const sum = (rows: typeof tx) => rows.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-50">Every cost head, with full drilldown</h1>
        <p className="mt-1 text-sm text-ink-500">
          Click a category to inspect individual payments. Historic debt remains against its original cost head but is
          separately identified.
        </p>
      </div>

      <ChartPicker title="Select departments" rows={pickerRows} selected={selectedHeads} onChange={setSelectedHeads} />

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Cost heads" value={String(list.length)} detail="Recorded account-head categories" href="/finance/cost-heads" />
        <Kpi title="All movements" value={usd(sum(tx), true)} detail="Includes costs, transfers and other movements" href="/finance/payments" />
        <Kpi
          title="Current operating"
          value={usd(sum(tx.filter((t) => isOperating(t, rawState.departments))), true)}
          detail="Excludes marked historical debt"
          href="/finance/payments?mode=operating"
        />
        <Kpi
          title="Historical debt"
          value={usd(sum(tx.filter((t) => t.debtPeriod !== "current")), true)}
          detail="Marked payments across all heads"
          purple
          href="/finance/historical-debt"
        />
      </div>

      <div className="mt-4 rounded-xl border border-base-700 bg-base-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-ink-50">
            {byCentre ? `Cost centres within ${filters.department}` : "Cost heads, visual breakdown"}
          </h3>
          <Link href="/finance/explorer" className="rounded-lg border border-base-700 px-2.5 py-1 text-[11px] text-ink-300 hover:text-ink-50">
            Open full explorer ↗
          </Link>
        </div>
        <DonutWidget
          wide
          rows={donutRows}
          otherLabel={byCentre ? "Other cost centres" : "Other heads"}
          hrefFor={(name) => (byCentre ? explorerHref(filters.department, name) : explorerHref(name))}
        />
      </div>

      <div className="mt-4 rounded-xl border border-base-700 bg-base-900 p-4">
        <div className="overflow-x-auto rounded-xl border border-base-700">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-base-700 bg-base-900 text-ink-500">
              <tr>
                <th className="px-3 py-2">Account head</th>
                <th className="px-3 py-2 text-right">Transactions</th>
                <th className="px-3 py-2 text-right">Total ledger value</th>
                <th className="px-3 py-2 text-right">Historical debt</th>
                <th className="px-3 py-2">Cost centres</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(([key, g]) => {
                const centres = Array.from(g.cent.entries()).sort((a, b) => b[1] - a[1]);
                return (
                  <tr key={key} className="border-b border-base-800 align-top text-ink-300 last:border-0">
                    <td className="px-3 py-2">
                      <Link href={explorerHref(key)} className="font-medium text-ink-50 hover:underline">
                        {key}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right">{g.count}</td>
                    <td className="px-3 py-2 text-right">{usd(g.total)}</td>
                    <td className="px-3 py-2 text-right">{usd(g.debt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {centres.slice(0, 3).map(([centre, amount]) => (
                          <Link
                            key={centre}
                            href={explorerHref(key, centre)}
                            className="rounded-full border border-base-700 px-2 py-0.5 text-[11px] text-ink-300 hover:text-ink-50"
                          >
                            {centre} ({usd(amount, true)})
                          </Link>
                        ))}
                        {centres.length > 3 && (
                          <span className="rounded-full bg-base-800 px-2 py-0.5 text-[11px] text-ink-500">+{centres.length - 3} more</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {pager}
        </div>
      </div>
    </div>
  );
}
