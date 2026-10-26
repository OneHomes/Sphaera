"use client";

import { useMemo } from "react";
import { History as HistoryIcon, AlertTriangle } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

type DebtTransaction = {
  id: string;
  date: string;
  description: string;
  managementDepartment: string | null;
  managementCostHead: string | null;
  amount: number;
  debtPeriod: string;
  reviewed: boolean;
};

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

const PERIOD_ORDER = ["2024-25", "older"];

const PERIOD_BADGE: Record<string, string> = {
  older: "bg-status-alert/15 text-status-alert",
  "2024-25": "bg-status-inactive/15 text-status-inactive",
};

const PERIOD_LABEL: Record<string, string> = {
  "2024-25": "FY 2024-25",
  older: "Older than FY 2024-25",
};

export function HistoricalDebtPage({ transactions }: { transactions: DebtTransaction[] }) {
  const sections = useMemo(() => {
    const byPeriod = new Map<string, DebtTransaction[]>();
    for (const t of transactions) {
      const list = byPeriod.get(t.debtPeriod) ?? [];
      list.push(t);
      byPeriod.set(t.debtPeriod, list);
    }
    const orderedKeys = [
      ...PERIOD_ORDER.filter((k) => byPeriod.has(k)),
      ...Array.from(byPeriod.keys()).filter((k) => !PERIOD_ORDER.includes(k)).sort(),
    ];
    return orderedKeys.map((period) => {
      const rows = byPeriod.get(period) ?? [];
      const total = rows.reduce((sum, t) => sum + t.amount, 0);
      return { period, rows, total };
    });
  }, [transactions]);

  const grandTotal = transactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Historical Debt</h1>
          <p className="mt-1 text-sm text-ink-500">
            Payments classified outside the current debt period, grouped by vintage
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tile label="Total historical debt" value={formatUsd(grandTotal)} />
        <Tile label="Payments flagged" value={transactions.length.toLocaleString()} />
        <Tile label="Debt periods" value={sections.length.toLocaleString()} />
      </div>

      {sections.length === 0 && (
        <WidgetCard title="No historical debt" icon={HistoryIcon}>
          <p className="text-xs text-ink-500">Every payment is classified under the current debt period.</p>
        </WidgetCard>
      )}

      <div className="space-y-4">
        {sections.map(({ period, rows, total }) => (
          <WidgetCard key={period} title={PERIOD_LABEL[period] ?? period} icon={AlertTriangle}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  PERIOD_BADGE[period] ?? "bg-status-alert/15 text-status-alert"
                }`}
              >
                {rows.length.toLocaleString()} payment(s)
              </span>
              <span className="text-sm font-semibold text-ink-50">{formatUsd(total)}</span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-base-700">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2">Department</th>
                    <th className="px-3 py-2">Cost Head</th>
                    <th className="px-3 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id} className="border-b border-base-800 text-ink-300 last:border-0">
                      <td className="px-3 py-2">{new Date(t.date).toLocaleDateString()}</td>
                      <td className="max-w-[240px] truncate px-3 py-2" title={t.description}>
                        {t.description}
                      </td>
                      <td className="px-3 py-2">
                        {t.managementDepartment ?? (
                          <span className="text-ink-600">Unclassified</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{t.managementCostHead ?? "—"}</td>
                      <td className="px-3 py-2">{formatUsd(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </WidgetCard>
        ))}
      </div>
    </div>
  );
}
