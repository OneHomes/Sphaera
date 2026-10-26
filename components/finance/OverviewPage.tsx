"use client";

import { LayoutDashboard, DollarSign, Inbox, AlertTriangle, TrendingUp } from "lucide-react";
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

export function OverviewPage({ state }: { state: FinanceState }) {
  const totalSpend = state.transactions.reduce((sum, t) => sum + t.amount, 0);
  const needsAllocation = state.transactions.filter((t) => !t.managementDepartment).length;
  const disputed = state.transactions.filter((t) => t.dispute && t.dispute.status !== "Resolved").length;
  const latestMonth = state.monthly[state.monthly.length - 1];

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">CEO Overview</h1>
          <p className="mt-1 text-sm text-ink-500">
            Finance snapshot across {state.transactions.length.toLocaleString()} payments
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <WidgetCard title="Total Spend" icon={DollarSign}>
          <Tile label="All recorded payments" value={formatUsd(totalSpend)} />
        </WidgetCard>
        <WidgetCard title="Needs Allocation" icon={Inbox}>
          <Tile label="Unclassified payments" value={needsAllocation.toLocaleString()} />
        </WidgetCard>
        <WidgetCard title="Disputed Charges" icon={AlertTriangle}>
          <Tile label="Open or under review" value={disputed.toLocaleString()} />
        </WidgetCard>
        <WidgetCard title="This Month" icon={TrendingUp}>
          {latestMonth ? (
            <div className="grid grid-cols-2 gap-2">
              <Tile label={`Collections (${latestMonth.month})`} value={formatUsd(latestMonth.collections)} />
              <Tile label="Plan" value={formatUsd(latestMonth.collectionsPlan)} />
            </div>
          ) : (
            <p className="text-xs text-ink-500">No monthly figures recorded yet.</p>
          )}
        </WidgetCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WidgetCard title="Monthly Collections vs Plan" icon={LayoutDashboard}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 text-ink-500">
                <tr>
                  <th className="px-2 py-1.5">Month</th>
                  <th className="px-2 py-1.5">Collections</th>
                  <th className="px-2 py-1.5">Plan</th>
                  <th className="px-2 py-1.5">Sales Plan</th>
                </tr>
              </thead>
              <tbody>
                {state.monthly.map((m) => (
                  <tr key={m.month} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="px-2 py-1.5">{m.month}</td>
                    <td className="px-2 py-1.5">{formatUsd(m.collections)}</td>
                    <td className="px-2 py-1.5">{formatUsd(m.collectionsPlan)}</td>
                    <td className="px-2 py-1.5">{formatUsd(m.salesPlan)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WidgetCard>

        <WidgetCard title="Recent Payments" icon={DollarSign}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 text-ink-500">
                <tr>
                  <th className="px-2 py-1.5">Date</th>
                  <th className="px-2 py-1.5">Description</th>
                  <th className="px-2 py-1.5">Department</th>
                  <th className="px-2 py-1.5">Amount</th>
                </tr>
              </thead>
              <tbody>
                {state.transactions
                  .slice()
                  .reverse()
                  .slice(0, 10)
                  .map((t) => (
                    <tr key={t.id} className="border-b border-base-800 text-ink-300 last:border-0">
                      <td className="px-2 py-1.5">{new Date(t.date).toLocaleDateString()}</td>
                      <td className="max-w-[160px] truncate px-2 py-1.5" title={t.description}>
                        {t.description}
                      </td>
                      <td className="px-2 py-1.5">
                        {t.managementDepartment ?? (
                          <span className="rounded-full bg-status-alert/15 px-2 py-0.5 text-[11px] font-medium text-status-alert">
                            Unclassified
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">{formatUsd(t.amount)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </WidgetCard>
      </div>
    </div>
  );
}
