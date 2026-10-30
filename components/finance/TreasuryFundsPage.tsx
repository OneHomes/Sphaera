"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  BankListItem,
  MovementModal,
  SettlementModal,
  TreasuryPendingNotice,
  TreasuryToolbar,
  trMoney,
  type BankRow,
  type FundName,
} from "@/components/finance/BanksPage";
import { ListSearch, ShowMoreBar, useListSearch, useShowMore } from "@/components/finance/ShowMore";

type FundBankRow = { bankId: string; amount: number; currency: string | null; usdEquivalent: number | null };
type FundRow = { fund: FundName; banks: FundBankRow[] };
type MovementRow = {
  id: string;
  bankAccountId: string;
  txnDate: string | Date;
  amount?: number;
  allocatedAmount: number;
  currency: string;
  reference: string | null;
  sourceUid: string;
};
type ErpSourceOption = { id: string; name: string; region: string | null; active: boolean };
type TreasuryState = { banks: BankRow[]; funds: FundRow[]; movements: MovementRow[] };
type Forecast = {
  from: string;
  to: string;
  outgoing: { date: string; label: string; amount: number; currency: string; bankSourceId: string }[];
  incoming: { bankAccountId: string | null; date: string; currency: string | null; amount: number | null; provider: string }[];
};

const HORIZONS = [1, 3, 12] as const;

// Port of the source treasuryFundsPage() + trForecastSection().
export function TreasuryFundsPage({ state: initialState, initialForecast }: { state: TreasuryState; initialForecast: Forecast }) {
  const router = useRouter();
  const [state, setState] = useState<TreasuryState>(initialState);
  const [forecast, setForecast] = useState<Forecast>(initialForecast);
  const [reloading, setReloading] = useState(false);
  const [entityFilter, setEntityFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [erpFilter, setErpFilter] = useState("all");
  const [erpSources, setErpSources] = useState<ErpSourceOption[]>([]);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [showUnallocated, setShowUnallocated] = useState(false);
  const [months, setMonths] = useState<1 | 3 | 12>(3);
  const [selectedFund, setSelectedFund] = useState<FundName>("S&M");

  useEffect(() => {
    fetch("/api/finance/erp/sources")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setErpSources(Array.isArray(data) ? data : []))
      .catch(() => setErpSources([]));
  }, []);

  async function loadForecast(m: 1 | 3 | 12) {
    const res = await fetch(`/api/finance/treasury/forecast?months=${m}`);
    if (res.ok) setForecast(await res.json());
  }

  async function reload() {
    setReloading(true);
    try {
      const res = await fetch("/api/finance/treasury/state");
      if (res.ok) setState(await res.json());
      await loadForecast(months);
    } finally {
      setReloading(false);
    }
  }

  const legalEntities = Array.from(new Set(state.banks.map((b) => b.legalEntity).filter((x): x is string => Boolean(x)))).sort();
  const currencies = Array.from(new Set(state.banks.map((b) => b.currency).filter((x): x is string => Boolean(x)))).sort();
  const activeErpSources = erpSources.filter((s) => s.active);

  const scoped = state.banks.filter(
    (b) =>
      (entityFilter === "all" || b.legalEntity === entityFilter) &&
      (currencyFilter === "all" || b.currency === currencyFilter) &&
      (erpFilter === "all" || b.erpSourceId === erpFilter)
  );

  const fundBanks = scoped.filter((x) => x.allocations[selectedFund] !== 0);
  const fxReady = fundBanks.every((x) => x.usdPerUnit != null);
  const equivalent = fxReady ? fundBanks.reduce((v, x) => v + x.allocations[selectedFund] * (x.usdPerUnit ?? 0), 0) : null;

  const entityTotals = new Map<string, number>();
  for (const a of scoped) {
    const key = `${a.legalEntity ?? "—"} · ${a.currency ?? "USD"}`;
    entityTotals.set(key, (entityTotals.get(key) ?? 0) + a.allocations["S&M"] + a.allocations.Development + a.allocations.Unallocated);
  }

  const unallocatedCount = state.funds.find((f) => f.fund === "Unallocated")?.banks.length ?? 0;

  const bankIds = new Set(scoped.map((x) => x.id));
  const sources = new Map(scoped.filter((x) => x.paymentSourceId).map((x) => [x.paymentSourceId!, x]));
  const income = forecast.incoming.filter((x) => x.bankAccountId && bankIds.has(x.bankAccountId));
  const out = forecast.outgoing.filter((x) => sources.has(x.bankSourceId));

  const scopeKey = `${entityFilter}|${currencyFilter}|${erpFilter}`;
  const bankSearchFields = (b: BankRow) => [
    b.label,
    b.bank,
    b.legalEntity,
    b.country,
    b.currency,
    b.maskedAccount,
    b.erpAccountNumber,
    b.erpAccountId,
  ];
  const fundSearch = useListSearch(fundBanks, bankSearchFields);
  const fundMore = useShowMore(fundSearch.filtered, `${selectedFund}|${scopeKey}|${fundSearch.filtered.length}|${fundSearch.query}`);
  const unallocatedBanks = scoped.filter((x) => x.allocations.Unallocated);
  const unallocatedSearch = useListSearch(unallocatedBanks, bankSearchFields);
  const unallocatedMore = useShowMore(
    unallocatedSearch.filtered,
    `${scopeKey}|${unallocatedSearch.filtered.length}|${unallocatedSearch.query}`
  );
  const entityRows = Array.from(entityTotals.entries());
  const entityMore = useShowMore(entityRows, `${scopeKey}|${entityRows.length}`);
  const bankLabel = (id: string | null) => state.banks.find((b) => b.id === id)?.label ?? "";
  const incomeSearch = useListSearch(income, (x) => [x.date, x.provider, x.currency, x.amount, bankLabel(x.bankAccountId)]);
  const incomeMore = useShowMore(incomeSearch.filtered, `${months}|${scopeKey}|${incomeSearch.filtered.length}|${incomeSearch.query}`);
  const outSearch = useListSearch(out, (x) => [x.date, x.label, x.currency, x.amount, sources.get(x.bankSourceId)?.label]);
  const outMore = useShowMore(outSearch.filtered, `${months}|${scopeKey}|${outSearch.filtered.length}|${outSearch.query}`);

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Treasury &amp; fund ownership</h1>
          <p className="mt-1 text-sm text-ink-500">
            Click S&amp;M or Development to see exactly which bank accounts hold that fund&apos;s allocations. Bank
            accounts have a separate tab.
          </p>
        </div>
        <button
          onClick={() => setShowMovementModal(true)}
          className="flex items-center gap-1 rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.75} /> Allocate a bank movement
        </button>
      </div>

      <TreasuryPendingNotice />

      <TreasuryToolbar
        legalEntities={legalEntities}
        currencies={currencies}
        erpSources={activeErpSources}
        entityFilter={entityFilter}
        currencyFilter={currencyFilter}
        erpFilter={erpFilter}
        onEntity={setEntityFilter}
        onCurrency={setCurrencyFilter}
        onErp={setErpFilter}
        onReload={reload}
        reloading={reloading}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {(["S&M", "Development"] as FundName[]).map((f) => {
          const filtered = scoped.filter((x) => x.allocations[f]);
          const hasFX = filtered.every((x) => x.usdPerUnit != null);
          const native = new Map<string, number>();
          filtered.forEach((x) => native.set(x.currency ?? "USD", (native.get(x.currency ?? "USD") ?? 0) + x.allocations[f]));
          return (
            <button
              key={f}
              onClick={() => setSelectedFund(f)}
              className={`rounded-xl border p-5 text-left transition ${
                selectedFund === f ? "border-status-active bg-base-800" : "border-base-700 bg-base-900 hover:border-base-600"
              }`}
            >
              <p className="text-[10px] uppercase tracking-wide text-ink-500">Fund balance ↗</p>
              <h2 className="mt-1 text-lg font-semibold text-ink-50">{f === "S&M" ? "Sales & Marketing" : "Development"}</h2>
              <p className="mt-2 text-2xl font-semibold text-ink-50">
                {hasFX ? trMoney(filtered.reduce((v, x) => v + x.allocations[f] * (x.usdPerUnit ?? 0), 0), "USD") : "FX rates required"}
              </p>
              <p className="mt-1 text-xs text-ink-300">
                {Array.from(native.entries()).map(([c, n]) => trMoney(n, c)).join(" · ") || "No allocated funds yet"} · {filtered.length} banks
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-base-700 bg-base-900 p-4">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-ink-50">{selectedFund} fund, bank-by-bank</h3>
            <p className="mt-1 text-[11px] text-ink-500">
              Native balance held at each bank. Currency conversion is displayed only where a timestamped rate is
              supplied.
            </p>
          </div>
          <span className="rounded-full bg-base-800 px-2 py-0.5 text-[11px] text-ink-300">
            {fxReady ? trMoney(equivalent, "USD") : "USD aggregate unavailable"}
          </span>
        </div>
        {fundBanks.length ? (
          <>
            <div className="mb-2">
              <ListSearch value={fundSearch.query} onChange={fundSearch.setQuery} placeholder="Filter banks, entities, accounts…" />
            </div>
            {fundSearch.filtered.length === 0 && (
              <p className="py-4 text-center text-xs text-ink-500">No banks match this filter.</p>
            )}
            <div className="space-y-2">
              {fundMore.visible.map((x) => (
                <BankListItem
                  key={x.id}
                  bank={x}
                  erpSources={erpSources}
                  onlyFund={selectedFund}
                  committedForFund={x.committedByFund?.[selectedFund] ?? 0}
                  onClick={() => router.push(`/finance/banks?bank=${encodeURIComponent(x.id)}`)}
                />
              ))}
            </div>
            <ShowMoreBar state={fundMore} />
          </>
        ) : (
          <p className="py-6 text-center text-xs text-ink-500">
            No fund allocation has been recorded for this selection. Add a bank and allocate receipts to begin.
          </p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-base-700 bg-base-900 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-ink-50">Funds not yet allocated</h3>
            <span className="rounded-full bg-status-alert/15 px-2 py-0.5 text-[11px] font-medium text-status-alert">
              {unallocatedCount} bank allocations
            </span>
          </div>
          <p className="mb-3 text-[11px] text-ink-500">
            Unallocated receipts and any unreconciled bank differences are not part of free S&amp;M or Development cash.
          </p>
          <button
            type="button"
            onClick={() => setShowUnallocated((v) => !v)}
            className="rounded-lg border border-base-700 px-2.5 py-1.5 text-[11px] text-ink-300 hover:text-ink-50"
          >
            Show unallocated balances
          </button>
          {showUnallocated && (
            <>
              {unallocatedBanks.length > 0 && (
                <div className="mt-2">
                  <ListSearch
                    value={unallocatedSearch.query}
                    onChange={unallocatedSearch.setQuery}
                    placeholder="Filter banks, entities, accounts…"
                  />
                </div>
              )}
              <div className="mt-2 space-y-2">
                {unallocatedMore.visible.map((x) => (
                  <BankListItem
                    key={x.id}
                    bank={x}
                    erpSources={erpSources}
                    onlyFund="Unallocated"
                    committedForFund={x.committedByFund?.Unallocated ?? 0}
                    onClick={() => router.push(`/finance/banks?bank=${encodeURIComponent(x.id)}`)}
                  />
                ))}
              </div>
              <ShowMoreBar state={unallocatedMore} />
            </>
          )}
        </div>

        <div className="rounded-xl border border-base-700 bg-base-900 p-4">
          <h3 className="text-sm font-medium text-ink-50">Fund balances by legal entity</h3>
          <p className="mb-3 mt-1 text-[11px] text-ink-500">
            This is a separate grouping of the same bank allocations, not additional money.
          </p>
          {entityTotals.size === 0 ? (
            <p className="py-4 text-center text-xs text-ink-500">No allocations entered.</p>
          ) : (
            <>
              {entityMore.visible.map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-base-800 py-1.5 text-xs last:border-0">
                  <b className="text-ink-50">{k}</b>
                  <strong className="text-ink-50">{trMoney(v, k.split(" · ").at(-1))}</strong>
                </div>
              ))}
              <ShowMoreBar state={entityMore} />
            </>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-base-700 bg-base-900 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-ink-50">Forward cash timing</h3>
            <p className="mt-1 text-[11px] text-ink-500">
              Incoming settlements only on expected bank arrival dates. Invoices, payroll and Amex count when the bank
              is due to pay, not when suppliers charge a card.
            </p>
          </div>
          <label className="flex flex-col text-[10px] font-medium uppercase tracking-wide text-ink-500">
            Horizon
            <select
              value={months}
              onChange={(e) => {
                const m = Number(e.target.value) as 1 | 3 | 12;
                setMonths(m);
                loadForecast(m);
              }}
              className="mt-1 rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs normal-case tracking-normal text-ink-50"
            >
              {HORIZONS.map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "30 days" : n === 3 ? "90 days" : "12 months"}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-50">Expected incoming processor settlements</p>
            {income.length ? (
              <>
                <div className="mb-1.5">
                  <ListSearch value={incomeSearch.query} onChange={incomeSearch.setQuery} placeholder="Filter payouts, banks…" />
                </div>
                {incomeSearch.filtered.length === 0 && (
                  <p className="py-4 text-center text-xs text-ink-500">No payouts match this filter.</p>
                )}
                {incomeMore.visible.map((x, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-base-800 py-1.5 text-xs last:border-0">
                    <span className="text-ink-300">
                      {x.date} · {x.provider}
                      <span className="block text-[11px] text-ink-500">{bankLabel(x.bankAccountId)}</span>
                    </span>
                    <strong className="text-ink-50">{trMoney(x.amount, x.currency)}</strong>
                  </div>
                ))}
                <ShowMoreBar state={incomeMore} />
              </>
            ) : (
              <p className="py-4 text-center text-xs text-ink-500">No expected payouts entered yet.</p>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-ink-50">Upcoming cash outgoings</p>
            {out.length ? (
              <>
                <div className="mb-1.5">
                  <ListSearch value={outSearch.query} onChange={outSearch.setQuery} placeholder="Filter outgoings…" />
                </div>
                {outSearch.filtered.length === 0 && (
                  <p className="py-4 text-center text-xs text-ink-500">No outgoings match this filter.</p>
                )}
                {outMore.visible.map((x, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-base-800 py-1.5 text-xs last:border-0">
                    <span className="text-ink-300">
                      {x.date} · {x.label}
                    </span>
                    <strong className="text-ink-50">{trMoney(x.amount, x.currency)}</strong>
                  </div>
                ))}
                <ShowMoreBar state={outMore} />
              </>
            ) : (
              <p className="py-4 text-center text-xs text-ink-500">No mapped bank commitments in this period.</p>
            )}
          </div>
        </div>
        <p className="mt-3 rounded-lg border border-status-alert/30 bg-status-alert/10 p-3 text-[11px] text-status-alert">
          Pending receipts are not bank cash. Missing ERP balances, unknown FX, unassigned payment accounts, unpaid card
          statements and incomplete salary schedules can make forecasts incomplete. See Credit Cycle for the full
          obligation calendar.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowSettlementModal(true)}
            className="flex items-center gap-1 rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} /> Record anticipated Stripe / Trust Payments payout
          </button>
          <Link
            href="/finance/credit-cycle"
            className="rounded-lg border border-base-700 px-3 py-2 text-xs text-ink-300 hover:border-base-600 hover:text-ink-50"
          >
            Open Credit Cycle
          </Link>
        </div>
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

      {showSettlementModal && (
        <SettlementModal
          banks={state.banks}
          movements={state.movements}
          onClose={() => setShowSettlementModal(false)}
          onSaved={() => {
            setShowSettlementModal(false);
            reload();
          }}
        />
      )}
    </div>
  );
}
