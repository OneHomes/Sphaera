"use client";

import { useMemo, useState } from "react";
import { PieChart as PieChartIcon, ListChecks, Receipt } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import type { FinanceState } from "@/lib/finance/ledgerData";

const UNCLASSIFIED = "Unclassified";

const COLORS = [
  "#14b8a6", // status-active
  "#ef4444", // status-inactive
  "#f59e0b", // status-alert
  "#d4af37", // tier-gold
  "#9ca3af", // tier-silver
  "#7965bd",
  "#b08d57", // tier-bronze
  "#3b82f6",
];

function formatUsd(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-base-700 bg-base-800 p-3">
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink-50">{value}</p>
    </div>
  );
}

export function SpendingExplorerPage({ state }: { state: FinanceState }) {
  const grouped = useMemo(() => {
    const byDept = new Map<string, { value: number; count: number }>();
    for (const t of state.transactions) {
      const key = t.managementDepartment ?? UNCLASSIFIED;
      const entry = byDept.get(key) ?? { value: 0, count: 0 };
      entry.value += t.amount;
      entry.count += 1;
      byDept.set(key, entry);
    }
    return Array.from(byDept.entries())
      .map(([name, { value, count }]) => ({ name, value, count }))
      .sort((a, b) => b.value - a.value);
  }, [state.transactions]);

  const allNames = useMemo(() => grouped.map((g) => g.name), [grouped]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const activeFilter = selected.size > 0;
  const filteredTransactions = useMemo(() => {
    if (!activeFilter) return state.transactions;
    return state.transactions.filter((t) => selected.has(t.managementDepartment ?? UNCLASSIFIED));
  }, [state.transactions, selected, activeFilter]);

  const filteredTotal = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
  const grandTotal = grouped.reduce((sum, g) => sum + g.value, 0);

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function clearAll() {
    setSelected(new Set());
  }

  function selectAll() {
    setSelected(new Set(allNames));
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Spending Explorer</h1>
          <p className="mt-1 text-sm text-ink-500">
            {state.transactions.length.toLocaleString()} payments across {grouped.length} departments —
            click a slice or check departments to drill down
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tile label="Total Spend (all departments)" value={formatUsd(grandTotal)} />
        <Tile
          label={activeFilter ? "Filtered Spend" : "Filtered Spend (no filter applied)"}
          value={formatUsd(filteredTotal)}
        />
        <Tile label="Payments in Selection" value={filteredTransactions.length.toLocaleString()} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <WidgetCard title="Spend by Department" icon={PieChartIcon} className="lg:col-span-3">
          <ResponsiveContainer width="100%" height={280}>
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
                    fill={COLORS[i % COLORS.length]}
                    opacity={!activeFilter || selected.has(entry.name) ? 1 : 0.25}
                    stroke="#111113"
                    strokeWidth={1}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#1a1a1d", border: "1px solid #232327", fontSize: 11 }}
                formatter={(value, name) => [formatUsd(Number(value ?? 0)), String(name)]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </WidgetCard>

        <WidgetCard
          title="Departments"
          icon={ListChecks}
          className="lg:col-span-2"
          action={
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="rounded-md px-2 py-0.5 text-[11px] font-medium text-ink-500 hover:text-ink-300"
              >
                All
              </button>
              <button
                onClick={clearAll}
                className="rounded-md px-2 py-0.5 text-[11px] font-medium text-ink-500 hover:text-ink-300"
              >
                Clear
              </button>
            </div>
          }
        >
          <div className="flex max-h-[260px] flex-col gap-1 overflow-y-auto">
            {grouped.map((g, i) => {
              const checked = selected.has(g.name);
              return (
                <label
                  key={g.name}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-base-800"
                >
                  <span className="flex items-center gap-2 text-ink-300">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(g.name)}
                      className="h-3.5 w-3.5 rounded border-base-600 bg-base-800 accent-status-active"
                    />
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: COLORS[i % COLORS.length] }}
                    />
                    {g.name}
                  </span>
                  <span className="shrink-0 text-ink-500">{formatUsd(g.value)}</span>
                </label>
              );
            })}
          </div>
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard title={`Payments${activeFilter ? ` — ${selected.size} department(s) selected` : ""}`} icon={Receipt}>
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Cost Head</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.slice(0, 200).map((t) => (
                  <tr key={t.id} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="px-3 py-1.5">{new Date(t.date).toLocaleDateString()}</td>
                    <td className="max-w-[260px] truncate px-3 py-1.5" title={t.description}>
                      {t.description}
                    </td>
                    <td className="px-3 py-1.5">
                      {t.managementDepartment ?? (
                        <span className="rounded-full bg-status-alert/15 px-2 py-0.5 text-[11px] font-medium text-status-alert">
                          {UNCLASSIFIED}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">{t.managementCostHead ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right">{formatUsd(t.amount)}</td>
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
    </div>
  );
}
