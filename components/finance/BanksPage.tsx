"use client";

import { useState } from "react";
import { Landmark, Wallet, X, Plus, Pencil, CheckCircle2, AlertTriangle } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

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

type TreasuryState = {
  banks: BankRow[];
  funds: FundRow[];
  asOf: string;
  integrationConnected: boolean;
};

function formatAmount(value: number | null, currency?: string | null): string {
  if (value === null || value === undefined) return "—";
  const prefix = currency ? `${currency} ` : "";
  return `${prefix}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | Date | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-base-700 bg-base-800 p-3">
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink-50">{value}</p>
    </div>
  );
}

export function BanksPage({ state: initialState }: { state: TreasuryState }) {
  const [state, setState] = useState<TreasuryState>(initialState);
  const [modalBank, setModalBank] = useState<BankRow | "new" | null>(null);
  const [reloading, setReloading] = useState(false);

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

  const verifiedCount = state.banks.filter((b) => b.verifiedCash).length;
  const totalCommitments = state.banks.reduce((s, b) => s + b.commitments, 0);

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Banks &amp; Accounts</h1>
          <p className="mt-1 text-sm text-ink-500">
            One row per real bank account. Click an account for its physical balance, fund allocations, and
            commitments.
            {!state.integrationConnected && " · No live processor/ERP feed connected"}
          </p>
        </div>
        <button
          onClick={() => setModalBank("new")}
          className="flex items-center gap-1 rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.75} /> + Add bank account
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <WidgetCard title="Bank Accounts" icon={Landmark}>
          <Tile label="Registered" value={state.banks.length.toLocaleString()} />
        </WidgetCard>
        <WidgetCard title="Verified Cash" icon={CheckCircle2}>
          <Tile label="Reconciled within 1 cent" value={`${verifiedCount} / ${state.banks.length}`} />
        </WidgetCard>
        <WidgetCard title="Outstanding Commitments" icon={Wallet}>
          <Tile label="Reserved, not yet paid" value={formatAmount(totalCommitments)} />
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard title="Bank register" icon={Landmark}
          action={<span className="rounded-full bg-base-800 px-2 py-0.5 text-[11px] text-ink-300">{state.banks.length} accounts</span>}
        >
            <div className="overflow-x-auto rounded-xl border border-base-700">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                  <tr>
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2">Bank</th>
                    <th className="px-3 py-2">Legal Entity</th>
                    <th className="px-3 py-2">Currency</th>
                    <th className="px-3 py-2">Physical Balance</th>
                    <th className="px-3 py-2">Allocated</th>
                    <th className="px-3 py-2">Reconciliation</th>
                    <th className="px-3 py-2">Commitments</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {state.banks.map((b) => (
                    <tr key={b.id} className="border-b border-base-800 text-ink-300 last:border-0">
                      <td className="px-3 py-2 text-ink-50">
                        {b.label}
                        {b.maskedAccount && <span className="text-ink-500"> · {b.maskedAccount}</span>}
                      </td>
                      <td className="px-3 py-2">{b.bank ?? "—"}</td>
                      <td className="px-3 py-2">{b.legalEntity ?? "—"}</td>
                      <td className="px-3 py-2">{b.currency ?? "—"}</td>
                      <td className="px-3 py-2">{formatAmount(b.physicalBalance, b.currency)}</td>
                      <td className="px-3 py-2">{formatAmount(b.allocatedTotal, b.currency)}</td>
                      <td className="px-3 py-2">
                        {b.reconciliationDifference === null ? (
                          <span className="text-ink-500">Awaiting ERP</span>
                        ) : (
                          formatAmount(b.reconciliationDifference, b.currency)
                        )}
                      </td>
                      <td className="px-3 py-2">{formatAmount(b.commitments, b.currency)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            b.active ? "bg-status-active/15 text-status-active" : "bg-status-inactive/15 text-status-inactive"
                          }`}
                        >
                          {b.active ? "Active" : "Inactive"}
                        </span>
                        {b.verifiedCash && (
                          <span className="ml-1 rounded-full bg-status-active/15 px-2 py-0.5 text-[11px] font-medium text-status-active">
                            Verified
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => setModalBank(b)} className="text-ink-500 hover:text-ink-300">
                          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {state.banks.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-3 py-6 text-center text-ink-500">
                        No bank accounts registered yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {reloading && <p className="mt-2 text-[11px] text-ink-500">Refreshing…</p>}
          </WidgetCard>
      </div>

      {modalBank && (
        <BankAccountModal
          bank={modalBank === "new" ? null : modalBank}
          onClose={() => setModalBank(null)}
          onSaved={() => {
            setModalBank(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500";

function BankAccountModal({
  bank,
  onClose,
  onSaved,
}: {
  bank: BankRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(bank?.label ?? "");
  const [bankName, setBankName] = useState(bank?.bank ?? "");
  const [legalEntity, setLegalEntity] = useState(bank?.legalEntity ?? "");
  const [currency, setCurrency] = useState(bank?.currency ?? "USD");
  const [maskedAccount, setMaskedAccount] = useState(bank?.maskedAccount ?? "");
  const [country, setCountry] = useState(bank?.country ?? "");
  const [usdPerUnit, setUsdPerUnit] = useState(bank?.usdPerUnit !== null && bank?.usdPerUnit !== undefined ? String(bank.usdPerUnit) : "");
  const [fxAsOf, setFxAsOf] = useState(bank?.fxAsOf ? new Date(bank.fxAsOf).toISOString().slice(0, 10) : "");
  const [active, setActive] = useState(bank?.active ?? true);
  const [erpSourceId, setErpSourceId] = useState(bank?.erpSourceId ?? "");
  const [erpAccountNumber, setErpAccountNumber] = useState(bank?.erpAccountNumber ?? "");
  const [paymentSourceId, setPaymentSourceId] = useState(bank?.paymentSourceId ?? "");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/treasury/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: bank?.id,
          label,
          bank: bankName,
          legalEntity,
          currency,
          maskedAccount: maskedAccount || undefined,
          country: country || undefined,
          usdPerUnit: usdPerUnit === "" ? undefined : Number(usdPerUnit),
          fxAsOf: fxAsOf || undefined,
          active,
          erpSourceId: erpSourceId || undefined,
          erpAccountNumber: erpAccountNumber || undefined,
          paymentSourceId: paymentSourceId || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to save bank account");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-50">{bank ? "Edit Bank Account" : "Register Bank Account"}</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-2.5 overflow-y-auto pr-1">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Account label" className={inputClass} />
          <div className="flex gap-2">
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Bank" className={inputClass} />
            <input value={legalEntity} onChange={(e) => setLegalEntity(e.target.value)} placeholder="Legal entity" className={inputClass} />
          </div>
          <div className="flex gap-2">
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              placeholder="Currency (e.g. USD)"
              maxLength={3}
              className={inputClass}
            />
            <input value={maskedAccount} onChange={(e) => setMaskedAccount(e.target.value)} placeholder="Masked account (optional)" className={inputClass} />
          </div>
          <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country (optional)" className={inputClass} />

          {currency !== "USD" && (
            <div className="flex gap-2">
              <input
                value={usdPerUnit}
                onChange={(e) => setUsdPerUnit(e.target.value)}
                placeholder="USD per unit (FX rate)"
                type="number"
                step="any"
                className={inputClass}
              />
              <input value={fxAsOf} onChange={(e) => setFxAsOf(e.target.value)} type="date" className={inputClass} />
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-ink-300">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active
          </label>

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="text-[11px] text-ink-500 hover:text-ink-300"
          >
            {showAdvanced ? "Hide" : "Show"} ERP / payment source linking
          </button>
          {showAdvanced && (
            <div className="space-y-2 rounded-lg border border-base-700 bg-base-800/40 p-2.5">
              <div className="flex gap-2">
                <input value={erpSourceId} onChange={(e) => setErpSourceId(e.target.value)} placeholder="ERP source ID" className={inputClass} />
                <input
                  value={erpAccountNumber}
                  onChange={(e) => setErpAccountNumber(e.target.value)}
                  placeholder="ERP account number"
                  className={inputClass}
                />
              </div>
              <input
                value={paymentSourceId}
                onChange={(e) => setPaymentSourceId(e.target.value)}
                placeholder="Payment source ID (for payment traceability)"
                className={inputClass}
              />
              <p className="text-[10px] text-ink-600">Provide both ERP fields together, or leave both blank.</p>
            </div>
          )}

          {error && (
            <p className="flex items-center gap-1 text-xs text-status-inactive">
              <AlertTriangle className="h-3 w-3" strokeWidth={1.75} /> {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isSaving || !label.trim() || !bankName.trim() || !legalEntity.trim() || !currency.trim()}
            className="w-full rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
          >
            {isSaving ? "Saving…" : bank ? "Save changes" : "Register account"}
          </button>
        </form>
      </div>
    </div>
  );
}
