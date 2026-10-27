"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import type { FinanceState } from "@/lib/finance/ledgerData";

// Direct structural/content port of the source app's headPage() (server
// render function, index.html line 1036) — "Every cost head, with full
// drilldown". Same 4 KPI cards (same titles/formulas/detail copy), same
// donut-of-spend widget that switches from a by-head to a by-centre
// breakdown once a head is selected, and the same table of cost heads with
// transaction count / total ledger value / historical debt / top-3 cost
// centres as clickable buttons. The source's "head"/"centre" vocabulary
// maps onto this port's managementDepartment/managementCostHead fields
// (see the source's effectiveHead()/effectiveCentre() helpers), matching
// the convention already established in OverviewPage.tsx. Only the visual
// implementation (recharts donut, Tailwind table) replaces the original's
// bespoke SVG doughnut/CSS — this is a re-skin, not a redesign.
//
// Not ported: the source's multi-select "chartPicker" (tick several heads
// to compare combined spend, data-pick-head checkboxes) — the single
// click-to-drill interaction below covers the "donut + table drilldown"
// requirement; the multi-select comparison tool is a separate, smaller
// feature that would need its own persisted selection state the rest of
// this port doesn't have yet.

const DONUT_COLORS = ["#009c91", "#2d6c85", "#e9a14b", "#8167b8", "#6ab4cc", "#d66b6e", "#8dad67", "#d9b95c", "#b4bed1"];

function usd(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (compact && Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${Math.round(value).toLocaleString()}`;
}

function Kpi({ title, value, detail, color }: { title: string; value: string; detail: string; color?: "purple" }) {
  const colorClass = color === "purple" ? "text-[#7965bd]" : "text-ink-50";
  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <h4 className="text-[11px] text-ink-500">{title}</h4>
      <div className={`mt-1 text-xl font-semibold ${colorClass}`}>{value}</div>
      <div className="mt-1 text-[11px] text-ink-500">{detail}</div>
    </div>
  );
}

// groupCosts() + the top-8-plus-"Other" bucketing from the source's
// donutWidget() (index.html ~line 784-789): proportions are based on
// positive net costs only, with the smallest entries folded into "Other".
function groupForDonut(rows: { key: string; value: number }[], otherLabel: string) {
  const positives = rows.filter((r) => r.value > 0);
  const largest = positives.slice(0, 8);
  const remaining = positives.slice(8);
  const other = remaining.length
    ? [{ key: otherLabel, value: remaining.reduce((s, r) => s + r.value, 0) }]
    : [];
  return [...largest, ...other];
}

export function CostHeadsPage({ state }: { state: FinanceState }) {
  const [selectedHead, setSelectedHead] = useState<string | null>(null);

  const activeDepartments = new Set(state.departments);
  const isOperating = (t: FinanceState["transactions"][number]) =>
    Boolean(t.managementDepartment) && activeDepartments.has(t.managementDepartment!) && t.debtPeriod === "current";

  const tx = state.transactions;

  const byHead = useMemo(() => {
    const m = new Map<
      string,
      { total: number; debt: number; count: number; centres: Map<string, number> }
    >();
    for (const t of tx) {
      const head = t.managementDepartment || "Unallocated";
      const centre = t.managementCostHead || "Needs allocation";
      if (!m.has(head)) m.set(head, { total: 0, debt: 0, count: 0, centres: new Map() });
      const h = m.get(head)!;
      h.total += t.amount;
      h.count += 1;
      if (t.debtPeriod !== "current") h.debt += t.amount;
      h.centres.set(centre, (h.centres.get(centre) ?? 0) + t.amount);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].total - a[1].total);
  }, [tx]);

  const headDonutData = useMemo(
    () => groupForDonut(byHead.map(([key, g]) => ({ key, value: g.total })), "Other heads"),
    [byHead]
  );

  const centreDonutData = useMemo(() => {
    if (!selectedHead) return [];
    const entry = byHead.find(([key]) => key === selectedHead);
    if (!entry) return [];
    const rows = Array.from(entry[1].centres.entries()).map(([key, value]) => ({ key, value }));
    rows.sort((a, b) => b.value - a.value);
    return groupForDonut(rows, "Other cost centres");
  }, [byHead, selectedHead]);

  const donutData = selectedHead ? centreDonutData : headDonutData;
  const allMovements = tx.reduce((s, t) => s + t.amount, 0);
  const currentOperating = tx.filter(isOperating).reduce((s, t) => s + t.amount, 0);
  const historicalDebt = tx.filter((t) => t.debtPeriod !== "current").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-50">Every cost head, with full drilldown</h1>
        <p className="mt-1 text-sm text-ink-500">
          Click a category to inspect individual payments. Historic debt remains against its original cost head but
          is separately identified.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Cost heads" value={String(byHead.length)} detail="Recorded account-head categories" />
        <Kpi
          title="All movements"
          value={usd(allMovements, true)}
          detail="Includes costs, transfers and other movements"
        />
        <Kpi
          title="Current operating"
          value={usd(currentOperating, true)}
          detail="Excludes marked historical debt"
        />
        <Kpi
          title="Historical debt"
          value={usd(historicalDebt, true)}
          detail="Marked payments across all heads"
          color="purple"
        />
      </div>

      <div className="mt-4 rounded-xl border border-base-700 bg-base-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-ink-50">
            {selectedHead ? `Cost centres within ${selectedHead}` : "Cost heads, visual breakdown"}
          </h3>
          <div className="flex items-center gap-2">
            {selectedHead && (
              <button
                onClick={() => setSelectedHead(null)}
                className="rounded-full border border-base-700 px-2 py-0.5 text-[11px] text-ink-300 hover:text-ink-50"
              >
                Clear selection ×
              </button>
            )}
            <Link href="/finance/explorer" className="text-[11px] text-ink-300 hover:text-ink-50">
              Open full explorer ↗
            </Link>
          </div>
        </div>
        {donutData.length === 0 ? (
          <p className="text-[11px] text-ink-500">
            There is no spending in this selection. Change the filters above.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={donutData}
                dataKey="value"
                nameKey="key"
                innerRadius={55}
                outerRadius={85}
                onClick={(entry: unknown) => {
                  const e = entry as { key?: string; payload?: { key?: string } };
                  const key = e?.payload?.key ?? e?.key;
                  if (!selectedHead && key && key !== "Other heads") setSelectedHead(key);
                }}
                className={selectedHead ? "" : "cursor-pointer"}
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
        )}
        <p className="mt-2 text-[11px] text-ink-500">
          Click a doughnut slice to see where the money goes, right down to each payment.
        </p>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-base-700">
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
            {byHead.map(([key, g]) => {
              const topCentres = Array.from(g.centres.entries()).sort((a, b) => b[1] - a[1]);
              return (
                <tr key={key} className="border-b border-base-800 text-ink-300 last:border-0 align-top">
                  <td className="px-3 py-2">
                    <button
                      onClick={() => setSelectedHead(selectedHead === key ? null : key)}
                      className={`font-medium hover:underline ${selectedHead === key ? "text-ink-50" : "text-ink-300"}`}
                    >
                      {key}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">{g.count}</td>
                  <td className="px-3 py-2 text-right">{usd(g.total)}</td>
                  <td className="px-3 py-2 text-right">{usd(g.debt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {topCentres.slice(0, 3).map(([centre, amount]) => (
                        <button
                          key={centre}
                          onClick={() => setSelectedHead(key)}
                          className="rounded-full border border-base-700 px-2 py-0.5 text-[11px] text-ink-300 hover:text-ink-50"
                        >
                          {centre} ({usd(amount, true)})
                        </button>
                      ))}
                      {topCentres.length > 3 && (
                        <span className="rounded-full bg-base-800 px-2 py-0.5 text-[11px] text-ink-500">
                          +{topCentres.length - 3} more
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {byHead.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-ink-500">
                  No cost heads recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
