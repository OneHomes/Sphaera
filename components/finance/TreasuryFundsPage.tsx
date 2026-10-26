"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

type FundName = "S&M" | "Development" | "Unallocated";

type FundBankRow = {
  bankId: string;
  label: string;
  bank: string | null;
  legalEntity: string | null;
  currency: string | null;
  amount: number;
  usdEquivalent: number | null;
};

type FundRow = {
  fund: FundName;
  banks: FundBankRow[];
  usdTotal: number | null;
  fxComplete: boolean;
  bankCount: number;
  pendingFX: number;
};

type TreasuryState = { funds: FundRow[] };

function formatAmount(value: number | null, currency?: string | null): string {
  if (value === null || value === undefined) return "—";
  const prefix = currency ? `${currency} ` : "";
  return `${prefix}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

// Faithful port of the source's treasuryFundsPage() — fund cards (S&M /
// Development, Unallocated shown separately below, not as a selectable
// card), click a card to drill into its bank-by-bank breakdown, plus a
// "funds not yet allocated" panel and a per-legal-entity rollup.
export function TreasuryFundsPage({ state }: { state: TreasuryState }) {
  const allocatableFunds = state.funds.filter((f) => f.fund !== "Unallocated");
  const unallocated = state.funds.find((f) => f.fund === "Unallocated");
  const [selectedFund, setSelectedFund] = useState<FundName>(allocatableFunds[0]?.fund ?? "S&M");
  const fund = state.funds.find((f) => f.fund === selectedFund) ?? allocatableFunds[0];

  const entityTotals = new Map<string, number>();
  for (const f of state.funds) {
    for (const b of f.banks) {
      const key = `${b.legalEntity ?? "—"} · ${b.currency ?? "—"}`;
      entityTotals.set(key, (entityTotals.get(key) ?? 0) + b.amount);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Treasury Funds</h1>
          <p className="mt-1 text-sm text-ink-500">
            Click S&amp;M or Development to see exactly which bank accounts hold that fund&apos;s allocations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {allocatableFunds.map((f) => (
          <button
            key={f.fund}
            onClick={() => setSelectedFund(f.fund)}
            className={`rounded-xl border p-4 text-left transition ${
              selectedFund === f.fund ? "border-status-active bg-base-800" : "border-base-700 bg-base-900 hover:border-base-600"
            }`}
          >
            <p className="text-[10px] uppercase tracking-wide text-ink-500">Fund balance</p>
            <h2 className="mt-1 text-lg font-semibold text-ink-50">
              {f.fund === "S&M" ? "Sales & Marketing" : "Development"}
            </h2>
            <p className="mt-2 text-xl font-semibold text-ink-50">
              {f.fxComplete ? formatAmount(f.usdTotal, "USD") : "FX rates required"}
            </p>
            <p className="mt-1 text-[11px] text-ink-500">{f.bankCount} bank(s)</p>
          </button>
        ))}
      </div>

      {fund && (
        <div className="mt-4">
          <WidgetCard
            title={`${fund.fund === "S&M" ? "Sales & Marketing" : fund.fund} fund, bank-by-bank`}
            icon={Wallet}
            action={
              <span className="rounded-full bg-base-800 px-2 py-0.5 text-[11px] text-ink-300">
                {fund.fxComplete ? formatAmount(fund.usdTotal, "USD") : "USD aggregate unavailable"}
              </span>
            }
          >
            <div className="space-y-1.5">
              {fund.banks.map((b) => (
                <div key={b.bankId} className="rounded-lg border border-base-700 bg-base-800/40 p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-50">{b.label}</span>
                    <span className="text-xs text-ink-300">{formatAmount(b.amount, b.currency)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[11px] text-ink-500">
                    <span>{b.bank ?? "—"}</span>
                    <span>{b.usdEquivalent !== null ? formatAmount(b.usdEquivalent, "USD") : "No FX quote"}</span>
                  </div>
                </div>
              ))}
              {fund.banks.length === 0 && (
                <p className="text-xs text-ink-500">
                  No fund allocation has been recorded for this selection. Add a bank and allocate receipts to begin.
                </p>
              )}
            </div>
          </WidgetCard>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WidgetCard
          title="Funds not yet allocated"
          icon={Wallet}
          action={
            <span className="rounded-full bg-status-alert/15 px-2 py-0.5 text-[11px] font-medium text-status-alert">
              {unallocated?.banks.length ?? 0} bank allocations
            </span>
          }
        >
          <p className="mb-2 text-xs text-ink-500">
            Unallocated receipts and any unreconciled bank differences are not part of free S&amp;M or Development
            cash.
          </p>
          <div className="space-y-1.5">
            {unallocated?.banks.map((b) => (
              <div key={b.bankId} className="rounded-lg border border-base-700 bg-base-800/40 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-50">{b.label}</span>
                  <span className="text-xs text-ink-300">{formatAmount(b.amount, b.currency)}</span>
                </div>
              </div>
            ))}
            {(!unallocated || unallocated.banks.length === 0) && (
              <p className="text-xs text-ink-500">No allocations entered.</p>
            )}
          </div>
        </WidgetCard>

        <WidgetCard title="Fund balances by legal entity" icon={Wallet}>
          <p className="mb-2 text-xs text-ink-500">This is a separate grouping of the same bank allocations, not additional money.</p>
          <div className="space-y-1">
            {Array.from(entityTotals.entries()).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded-lg border border-base-700 bg-base-800/40 px-2 py-1.5 text-xs">
                <span className="text-ink-300">{key}</span>
                <span className="font-medium text-ink-50">{formatAmount(value, key.split(" · ").at(-1))}</span>
              </div>
            ))}
            {entityTotals.size === 0 && <p className="text-xs text-ink-500">No allocations entered.</p>}
          </div>
        </WidgetCard>
      </div>
    </div>
  );
}
