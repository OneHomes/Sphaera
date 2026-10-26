"use client";

import { useMemo } from "react";
import { BarChart3, ClipboardList } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import type { FinanceState } from "@/lib/finance/ledgerData";

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

export function BudgetVsActualPage({ state }: { state: FinanceState }) {
  const rows = useMemo(
    () =>
      state.monthly.map((m) => ({
        month: m.month,
        collections: m.collections,
        collectionsPlan: m.collectionsPlan,
        salesPlan: m.salesPlan,
        variance: m.collections - m.collectionsPlan,
        variancePct: m.collectionsPlan !== 0 ? ((m.collections - m.collectionsPlan) / m.collectionsPlan) * 100 : null,
      })),
    [state.monthly]
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          collections: acc.collections + r.collections,
          collectionsPlan: acc.collectionsPlan + r.collectionsPlan,
          salesPlan: acc.salesPlan + r.salesPlan,
          variance: acc.variance + r.variance,
        }),
        { collections: 0, collectionsPlan: 0, salesPlan: 0, variance: 0 }
      ),
    [rows]
  );

  const monthsOverPlan = rows.filter((r) => r.variance >= 0).length;

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Budget vs Actual</h1>
          <p className="mt-1 text-sm text-ink-500">
            Collections actual vs plan across {rows.length} recorded months
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Total Collections (Actual)" value={formatUsd(totals.collections)} />
        <Tile label="Total Collections (Plan)" value={formatUsd(totals.collectionsPlan)} />
        <Tile label="Total Sales Plan" value={formatUsd(totals.salesPlan)} />
        <Tile
          label="Cumulative Variance"
          value={`${totals.variance >= 0 ? "+" : ""}${formatUsd(totals.variance)}`}
        />
      </div>

      <div className="mt-4">
        <WidgetCard title="Monthly Collections: Actual vs Plan" icon={BarChart3}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#232327" />
              <XAxis dataKey="month" stroke="#71717a" fontSize={10} />
              <YAxis stroke="#71717a" fontSize={10} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip
                contentStyle={{ background: "#1a1a1d", border: "1px solid #232327", fontSize: 11 }}
                formatter={(value) => [`$${Number(value ?? 0).toLocaleString()}`]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="collections" name="Actual Collections" fill="#14b8a6" />
              <Bar dataKey="collectionsPlan" name="Collections Plan" fill="#9ca3af" />
              <Bar dataKey="salesPlan" name="Sales Plan" fill="#d4af37" />
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-1 text-[10px] text-ink-500">
            {monthsOverPlan} of {rows.length} months met or exceeded the collections plan.
          </p>
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard title="Monthly Variance" icon={ClipboardList}>
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Month</th>
                  <th className="px-3 py-2 text-right">Actual Collections</th>
                  <th className="px-3 py-2 text-right">Collections Plan</th>
                  <th className="px-3 py-2 text-right">Sales Plan</th>
                  <th className="px-3 py-2 text-right">Variance</th>
                  <th className="px-3 py-2 text-right">Variance %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const overPlan = r.variance >= 0;
                  return (
                    <tr key={r.month} className="border-b border-base-800 text-ink-300 last:border-0">
                      <td className="px-3 py-1.5">{r.month}</td>
                      <td className="px-3 py-1.5 text-right">{formatUsd(r.collections)}</td>
                      <td className="px-3 py-1.5 text-right">{formatUsd(r.collectionsPlan)}</td>
                      <td className="px-3 py-1.5 text-right">{formatUsd(r.salesPlan)}</td>
                      <td
                        className={`px-3 py-1.5 text-right font-medium ${
                          overPlan ? "text-status-active" : "text-status-inactive"
                        }`}
                      >
                        {overPlan ? "+" : ""}
                        {formatUsd(r.variance)}
                      </td>
                      <td
                        className={`px-3 py-1.5 text-right font-medium ${
                          overPlan ? "text-status-active" : "text-status-inactive"
                        }`}
                      >
                        {r.variancePct === null ? "—" : `${overPlan ? "+" : ""}${r.variancePct.toFixed(1)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="p-4 text-center text-xs text-ink-500">No monthly plan/actual figures recorded yet.</p>
            )}
          </div>
        </WidgetCard>
      </div>
    </div>
  );
}
