"use client";

import { useMemo } from "react";
import { FileClock, DollarSign, Inbox, AlertTriangle, TrendingUp, Building2 } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import type { FinanceState } from "@/lib/finance/ledgerData";

const UNCLASSIFIED = "Unclassified";
const DAY_MS = 24 * 60 * 60 * 1000;

function formatUsd(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: "active" | "inactive" | "alert" }) {
  const toneClass =
    tone === "active" ? "text-status-active" : tone === "inactive" ? "text-status-inactive" : tone === "alert" ? "text-status-alert" : "text-ink-50";
  return (
    <div className="rounded-lg border border-base-700 bg-base-800 p-3">
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

export function WeeklyCeoBriefPage({ state }: { state: FinanceState }) {
  const { weekTotal, weekStart, weekEnd, monthTotal, currentMonthKey, topDepartments, needsAllocation, disputed, latestMonth } =
    useMemo(() => {
      const dates = state.transactions.map((t) => new Date(t.date).getTime()).filter((n) => !Number.isNaN(n));
      const asOf = dates.length > 0 ? new Date(Math.max(...dates)) : new Date();
      const weekStart = new Date(asOf.getTime() - 6 * DAY_MS);

      const monthKey = `${asOf.getUTCFullYear()}-${String(asOf.getUTCMonth() + 1).padStart(2, "0")}`;

      let weekTotal = 0;
      let monthTotal = 0;
      const byDept = new Map<string, number>();

      for (const t of state.transactions) {
        const d = new Date(t.date);
        if (!Number.isNaN(d.getTime()) && d.getTime() >= weekStart.getTime() && d.getTime() <= asOf.getTime()) {
          weekTotal += t.amount;
        }
        if (t.month === monthKey) {
          monthTotal += t.amount;
          const key = t.managementDepartment ?? UNCLASSIFIED;
          byDept.set(key, (byDept.get(key) ?? 0) + t.amount);
        }
      }

      const topDepartments = Array.from(byDept.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      const needsAllocation = state.transactions.filter((t) => !t.managementDepartment).length;
      const disputed = state.transactions.filter((t) => t.dispute && t.dispute.status !== "Resolved").length;
      const latestMonth = state.monthly[state.monthly.length - 1];

      return {
        weekTotal,
        weekStart,
        weekEnd: asOf,
        monthTotal,
        currentMonthKey: monthKey,
        topDepartments,
        needsAllocation,
        disputed,
        latestMonth,
      };
    }, [state.transactions, state.monthly]);

  const dateFmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const collectionsVariance = latestMonth ? latestMonth.collections - latestMonth.collectionsPlan : 0;

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Weekly CEO Brief</h1>
          <p className="mt-1 text-sm text-ink-500">
            As of data through {weekEnd.toLocaleDateString()} — a 30-second snapshot of spend and collections
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <WidgetCard title="This Week" icon={DollarSign}>
          <Tile label={`${dateFmt(weekStart)} – ${dateFmt(weekEnd)}`} value={formatUsd(weekTotal)} />
        </WidgetCard>
        <WidgetCard title="This Month" icon={TrendingUp}>
          <Tile label={`Spend in ${currentMonthKey}`} value={formatUsd(monthTotal)} />
        </WidgetCard>
        <WidgetCard title="Needs Allocation" icon={Inbox}>
          <Tile label="Unclassified payments" value={needsAllocation.toLocaleString()} tone={needsAllocation > 0 ? "alert" : "active"} />
        </WidgetCard>
        <WidgetCard title="Disputed" icon={AlertTriangle}>
          <Tile label="Open or under review" value={disputed.toLocaleString()} tone={disputed > 0 ? "inactive" : "active"} />
        </WidgetCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WidgetCard title="Top 5 Departments This Month" icon={Building2}>
          {topDepartments.length === 0 ? (
            <p className="text-xs text-ink-500">No spend recorded for {currentMonthKey}.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {topDepartments.map((d, i) => {
                const max = topDepartments[0].value || 1;
                const pct = Math.round((d.value / max) * 100);
                return (
                  <div key={d.name}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-ink-300">
                        {i + 1}. {d.name}
                      </span>
                      <span className="text-ink-500">{formatUsd(d.value)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-base-800">
                      <div className="h-full rounded-full bg-status-active" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </WidgetCard>

        <WidgetCard title="Latest Monthly Collections vs Plan" icon={FileClock}>
          {latestMonth ? (
            <div className="grid grid-cols-2 gap-3">
              <Tile label={`Collections (${latestMonth.month})`} value={formatUsd(latestMonth.collections)} />
              <Tile label="Collections Plan" value={formatUsd(latestMonth.collectionsPlan)} />
              <Tile label="Sales Plan" value={formatUsd(latestMonth.salesPlan)} />
              <Tile
                label="Variance vs Plan"
                value={`${collectionsVariance >= 0 ? "+" : ""}${formatUsd(collectionsVariance)}`}
                tone={collectionsVariance >= 0 ? "active" : "inactive"}
              />
            </div>
          ) : (
            <p className="text-xs text-ink-500">No monthly figures recorded yet.</p>
          )}
        </WidgetCard>
      </div>
    </div>
  );
}
