"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, Landmark, Plus, AlertTriangle, RefreshCw } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { BankAccountModal, MovementModal } from "@/components/finance/BanksPage";

type FundName = "S&M" | "Development" | "Unallocated";

type BankRow = {
  id: string;
  label: string;
  bank: string | null;
  maskedAccount: string | null;
  country: string | null;
  legalEntity: string | null;
  currency: string | null;
  erpAccountId: string | null;
  erpSourceId: string | null;
  erpAccountNumber: string | null;
  paymentSourceId: string | null;
  usdPerUnit: number | null;
  fxAsOf: string | Date | null;
  active: boolean;
  balanceSource: string;
  physicalBalance: number | null;
  availableBankBalance: number | null;
  asOf: string | Date | null;
  allocations: Record<FundName, number>;
  allocatedTotal: number;
  reconciliationDifference: number | null;
  commitments: number;
  fundedLessCommitments: number;
  pendingPayouts: number;
  verifiedCash: boolean;
  hasFX: boolean;
};

type FundBankRow = {
  bankId: string;
  label: string;
  bank: string | null;
  maskedAccount: string | null;
  legalEntity: string | null;
  country: string | null;
  currency: string | null;
  amount: number;
  usdEquivalent: number | null;
  fxAsOf: string | Date | null;
  bankLastReconciled: string | Date | null;
  bankReconciliationGap: number | null;
};

type FundRow = {
  fund: FundName;
  banks: FundBankRow[];
  usdTotal: number | null;
  fxComplete: boolean;
  bankCount: number;
  pendingFX: number;
};

type SettlementRow = {
  id: string;
  provider: string;
  payoutId: string;
  bankAccountId: string | null;
  currency: string | null;
  net: number | null;
  expectedDate: string | Date | null;
  status: string;
  fund: string | null;
};

type ErpSourceOption = {
  id: string;
  name: string;
  region: string | null;
  active: boolean;
};

type TreasuryState = {
  banks: BankRow[];
  funds: FundRow[];
  settlements: SettlementRow[];
  asOf: string;
  integrationConnected: boolean;
};

const HORIZONS = [1, 3, 12] as const;

function formatAmount(value: number | null, currency?: string | null): string {
  if (value === null || value === undefined) return "—";
  const prefix = currency ? `${currency} ` : "";
  return `${prefix}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | Date | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

// Faithful port of the source's treasuryFundsPage() — fund cards (S&M /
// Development, Unallocated shown separately below, not as a selectable
// card), click a card to drill into its bank-by-bank breakdown, the
// trFilters()/trMissing() bar shared with Banks & Accounts, a "funds not
// yet allocated" panel (default-collapsed, matching the source), a
// per-legal-entity rollup, a treasury editor (reusing BanksPage's bank
// modal) and the trForecastSection() "Forward cash timing" panel.
export function TreasuryFundsPage({ state: initialState }: { state: TreasuryState }) {
  const [state, setState] = useState<TreasuryState>(initialState);
  const [reloading, setReloading] = useState(false);
  const [entityFilter, setEntityFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [erpFilter, setErpFilter] = useState("all");
  const [erpSources, setErpSources] = useState<ErpSourceOption[]>([]);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showBankModal, setShowBankModal] = useState<BankRow | "new" | null>(null);
  const [showUnallocated, setShowUnallocated] = useState(false);
  const [months, setMonths] = useState<1 | 3 | 12>(1);

  useEffect(() => {
    fetch("/api/finance/erp/sources")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setErpSources(Array.isArray(data) ? data : []))
      .catch(() => setErpSources([]));
  }, []);

  async function reload() {
    setReloading(true);
    try {
      const res = await fetch("/api/finance/treasury/state");
      if (res.ok) {
        setState(await res.json());
      }
    } finally {
      setReloading(false);
    }
  }

  const allocatableFunds = state.funds.filter((f) => f.fund !== "Unallocated");
  const unallocated = state.funds.find((f) => f.fund === "Unallocated");
  const [selectedFund, setSelectedFund] = useState<FundName>(allocatableFunds[0]?.fund ?? "S&M");
  const fund = state.funds.find((f) => f.fund === selectedFund) ?? allocatableFunds[0];

  const legalEntities = Array.from(
    new Set(state.banks.map((b) => b.legalEntity).filter((x): x is string => Boolean(x)))
  ).sort();
  const currencies = Array.from(
    new Set(state.banks.map((b) => b.currency).filter((x): x is string => Boolean(x)))
  ).sort();
  const activeErpSources = erpSources.filter((s) => s.active);

  const scopedBanks = state.banks.filter(
    (b) =>
      (entityFilter === "all" || b.legalEntity === entityFilter) &&
      (currencyFilter === "all" || b.currency === currencyFilter) &&
      (erpFilter === "all" || b.erpSourceId === erpFilter)
  );
  const scopedBankIds = new Set(scopedBanks.map((b) => b.id));
  const scopeFundBanks = (rows: FundBankRow[]) => rows.filter((r) => scopedBankIds.has(r.bankId));

  const fundBanks = fund ? scopeFundBanks(fund.banks) : [];
  const fxReady = fundBanks.length > 0 && fundBanks.every((b) => b.usdEquivalent !== null);
  const equivalent = fxReady ? fundBanks.reduce((s, b) => s + (b.usdEquivalent ?? 0), 0) : null;

  const entityTotals = new Map<string, number>();
  for (const f of state.funds) {
    for (const b of scopeFundBanks(f.banks)) {
      const key = `${b.legalEntity ?? "—"} · ${b.currency ?? "—"}`;
      entityTotals.set(key, (entityTotals.get(key) ?? 0) + b.amount);
    }
  }

  const unallocatedBanks = scopeFundBanks(unallocated?.banks ?? []);

  const horizonCutoff = new Date();
  horizonCutoff.setMonth(horizonCutoff.getMonth() + months);
  const incoming = state.settlements
    .filter(
      (s) =>
        s.bankAccountId &&
        scopedBankIds.has(s.bankAccountId) &&
        ["Pending", "Scheduled", "In transit"].includes(s.status) &&
        s.expectedDate &&
        new Date(s.expectedDate) <= horizonCutoff
    )
    .sort((a, b) => new Date(a.expectedDate ?? 0).getTime() - new Date(b.expectedDate ?? 0).getTime());

  function bankLabel(id: string | null): string {
    return state.banks.find((b) => b.id === id)?.label ?? "";
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Treasury &amp; fund ownership</h1>
          <p className="mt-1 text-sm text-ink-500">
            Click S&amp;M or Development to see exactly which bank accounts hold that fund&apos;s allocations. Bank
            accounts have a separate tab.
          </p>
        </div>
        <button
          onClick={() => setShowMovementModal(true)}
          className="flex items-center gap-1 rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.75} /> + Allocate a bank movement
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-base-700 bg-base-900 p-3">
        <label className="flex flex-col gap-1 text-[11px] text-ink-500">
          Legal entity
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs text-ink-50"
          >
            <option value="all">All entities</option>
            {legalEntities.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-ink-500">
          Bank currency
          <select
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            className="rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs text-ink-50"
          >
            <option value="all">All currencies</option>
            {currencies.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-ink-500">
          Regional ERP
          <select
            value={erpFilter}
            onChange={(e) => setErpFilter(e.target.value)}
            className="rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs text-ink-50"
          >
            <option value="all">All three ERPs</option>
            {activeErpSources.map((x) => (
              <option key={x.id} value={x.id}>
                {x.region || "Unassigned"} · {x.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={reload}
          disabled={reloading}
          className="flex items-center gap-1 rounded-lg border border-base-700 px-3 py-1.5 text-xs text-ink-300 hover:text-ink-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${reloading ? "animate-spin" : ""}`} strokeWidth={1.75} /> Refresh
        </button>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-xl border border-status-alert/30 bg-status-alert/10 p-3 text-xs text-status-alert">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
        <p>
          <strong>ERP integration pending.</strong> Bank balances are shown only when supplied by the ERP. Fund
          allocations may be recorded manually or imported from Finance-approved ERP fund tags and are not
          automatically verified bank cash. Do not treat a fund allocation as a confirmed available bank balance
          until reconciliation is complete.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {allocatableFunds.map((f) => {
          const cardBanks = scopeFundBanks(f.banks);
          const hasFX = cardBanks.length > 0 && cardBanks.every((b) => b.usdEquivalent !== null);
          const native = new Map<string, number>();
          cardBanks.forEach((b) => {
            const cur = b.currency ?? "—";
            native.set(cur, (native.get(cur) ?? 0) + b.amount);
          });
          const totalUSD = hasFX ? cardBanks.reduce((s, b) => s + (b.usdEquivalent ?? 0), 0) : null;
          return (
            <button
              key={f.fund}
              onClick={() => setSelectedFund(f.fund)}
              className={`rounded-xl border p-4 text-left transition ${
                selectedFund === f.fund ? "border-status-active bg-base-800" : "border-base-700 bg-base-900 hover:border-base-600"
              }`}
            >
              <p className="text-[10px] uppercase tracking-wide text-ink-500">FUND BALANCE ↗</p>
              <h2 className="mt-1 text-lg font-semibold text-ink-50">
                {f.fund === "S&M" ? "Sales & Marketing" : "Development"}
              </h2>
              <p className="mt-2 text-xl font-semibold text-ink-50">
                {hasFX ? formatAmount(totalUSD, "USD") : "FX rates required"}
              </p>
              <p className="mt-1 text-[11px] text-ink-500">
                {Array.from(native.entries())
                  .map(([c, n]) => formatAmount(n, c))
                  .join(" · ") || "No allocated funds yet"}{" "}
                · {cardBanks.length} bank{cardBanks.length === 1 ? "" : "s"}
              </p>
            </button>
          );
        })}
      </div>

      {fund && (
        <div className="mt-4">
          <WidgetCard
            title={`${fund.fund} fund, bank-by-bank`}
            icon={Wallet}
            action={
              <span className="rounded-full bg-base-800 px-2 py-0.5 text-[11px] text-ink-300">
                {fxReady ? formatAmount(equivalent, "USD") : "USD aggregate unavailable"}
              </span>
            }
          >
            <p className="mb-2 text-xs text-ink-500">
              Native balance held at each bank. Currency conversion is displayed only where a timestamped rate is
              supplied.
            </p>
            <div className="space-y-1.5">
              {fundBanks.map((b) => (
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
              {fundBanks.length === 0 && (
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
          <button
            type="button"
            onClick={() => setShowUnallocated((v) => !v)}
            className="mb-2 rounded-lg border border-base-700 px-2.5 py-1 text-[11px] text-ink-300 hover:text-ink-50"
          >
            {showUnallocated ? "Hide unallocated balances" : "Show unallocated balances"}
          </button>
          {showUnallocated && (
            <div className="space-y-1.5">
              {unallocatedBanks.map((b) => (
                <div key={b.bankId} className="rounded-lg border border-base-700 bg-base-800/40 p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-50">{b.label}</span>
                    <span className="text-xs text-ink-300">{formatAmount(b.amount, b.currency)}</span>
                  </div>
                </div>
              ))}
              {unallocatedBanks.length === 0 && <p className="text-xs text-ink-500">No allocations entered.</p>}
            </div>
          )}
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

      <div className="mt-4">
        <WidgetCard
          title="Register or edit a company bank"
          icon={Landmark}
          action={
            <button
              onClick={() => setShowBankModal("new")}
              className="rounded-full bg-ink-50 px-2 py-0.5 text-[11px] font-medium text-base-950 hover:bg-white"
            >
              + Add bank account
            </button>
          }
        >
          <p className="mb-2 text-xs text-ink-500">Saved locally to the treasury ledger. No changes posted to the ERP.</p>
          <div className="flex flex-wrap gap-1.5">
            {state.banks.map((b) => (
              <button
                key={b.id}
                onClick={() => setShowBankModal(b)}
                className="rounded-full border border-base-700 px-2.5 py-1 text-[11px] text-ink-300 hover:text-ink-50"
              >
                {b.label}
              </button>
            ))}
            {state.banks.length === 0 && <p className="text-xs text-ink-500">No bank accounts registered yet.</p>}
          </div>
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard
          title="Forward cash timing"
          icon={Wallet}
          action={
            <label className="flex items-center gap-1.5 text-[11px] text-ink-500">
              Horizon
              <select
                value={months}
                onChange={(e) => setMonths(Number(e.target.value) as 1 | 3 | 12)}
                className="rounded-lg border border-base-700 bg-base-800 px-2 py-1 text-xs text-ink-50"
              >
                {HORIZONS.map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? "30 days" : n === 3 ? "90 days" : "12 months"}
                  </option>
                ))}
              </select>
            </label>
          }
        >
          <p className="mb-3 text-xs text-ink-500">
            Incoming settlements only on expected bank arrival dates. Invoices, payroll and Amex count when the bank
            is due to pay, not when suppliers charge a card.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-xs font-medium text-ink-50">Expected incoming processor settlements</p>
              <div className="space-y-1.5">
                {incoming.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-base-700 bg-base-800/40 px-2 py-1.5 text-xs"
                  >
                    <span className="text-ink-300">
                      {formatDate(s.expectedDate)} · {s.provider}
                      <span className="block text-[11px] text-ink-500">{bankLabel(s.bankAccountId)}</span>
                    </span>
                    <span className="font-medium text-ink-50">{formatAmount(s.net, s.currency)}</span>
                  </div>
                ))}
                {incoming.length === 0 && <p className="text-xs text-ink-500">No expected payouts entered yet.</p>}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-ink-50">Upcoming cash outgoings</p>
              <p className="text-xs text-ink-500">No mapped bank commitments in this period.</p>
            </div>
          </div>
          <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-status-alert/30 bg-status-alert/10 p-2 text-[11px] text-status-alert">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            Pending receipts are not bank cash. Missing ERP balances, unknown FX, unassigned payment accounts,
            unpaid card statements and incomplete salary schedules can make forecasts incomplete. See Credit Cycle
            for the full obligation calendar.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              title="Settlement entry is not available on this screen yet"
              className="rounded-full border border-base-700 px-2.5 py-1 text-[11px] text-ink-500"
            >
              + Record anticipated Stripe / Trust Payments payout
            </button>
            <Link
              href="/finance/credit-cycle"
              className="rounded-full border border-base-700 px-2.5 py-1 text-[11px] text-ink-300 hover:text-ink-50"
            >
              Open Credit Cycle
            </Link>
          </div>
        </WidgetCard>
      </div>

      {showMovementModal && (
        <MovementModal
          banks={state.banks}
          onClose={() => setShowMovementModal(false)}
          onSaved={() => {
            setShowMovementModal(false);
            reload();
          }}
        />
      )}

      {showBankModal && (
        <BankAccountModal
          bank={showBankModal === "new" ? null : showBankModal}
          onClose={() => setShowBankModal(null)}
          onSaved={() => {
            setShowBankModal(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
