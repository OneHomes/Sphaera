"use client";

import { useEffect, useState } from "react";
import {
  Landmark,
  Wallet,
  X,
  Plus,
  Pencil,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  PieChart as PieChartIcon,
  Receipt,
  CreditCard,
} from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

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

type MovementRow = {
  id: string;
  bankAccountId: string;
  sourceUid: string;
  txnDate: string | Date;
  transactionType: string | null;
  reference: string | null;
  description: string | null;
  approvedBy: string | null;
  fund: string;
  allocatedAmount: number;
  currency: string;
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
  reconciledLedgerId: string | null;
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
  movements: MovementRow[];
  settlements: SettlementRow[];
  asOf: string;
  integrationConnected: boolean;
};

const FUND_COLORS: Record<FundName, string> = {
  "S&M": "#0b9c90",
  Development: "#4d7dd6",
  Unallocated: "#c9a24b",
};

const MOVEMENT_KINDS = [
  "ERP receipt",
  "ERP payment",
  "Opening balance allocation",
  "Manual receipt",
  "Manual payment",
  "Fund adjustment",
  "Fund reclassification",
] as const;

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
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [entityFilter, setEntityFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [erpFilter, setErpFilter] = useState("all");
  const [erpSources, setErpSources] = useState<ErpSourceOption[]>([]);

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
  const selectedBank = state.banks.find((b) => b.id === selectedBankId) ?? null;

  const verifiedCount = scopedBanks.filter((b) => b.verifiedCash).length;
  const totalCommitments = scopedBanks.reduce((s, b) => s + b.commitments, 0);

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Banks &amp; Accounts</h1>
          <p className="mt-1 text-sm text-ink-500">
            One row per real bank account. Click an account for its physical ERP balance, fund allocations,
            transactions, exceptions and expected payouts.
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <WidgetCard title="Bank Accounts" icon={Landmark}>
          <Tile label="Registered" value={scopedBanks.length.toLocaleString()} />
        </WidgetCard>
        <WidgetCard title="Verified Cash" icon={CheckCircle2}>
          <Tile label="Reconciled within 1 cent" value={`${verifiedCount} / ${scopedBanks.length}`} />
        </WidgetCard>
        <WidgetCard title="Outstanding Commitments" icon={Wallet}>
          <Tile label="Reserved, not yet paid" value={formatAmount(totalCommitments)} />
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard title="Bank register" icon={Landmark}
          action={<span className="rounded-full bg-base-800 px-2 py-0.5 text-[11px] text-ink-300">{scopedBanks.length} accounts</span>}
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
                  {scopedBanks.map((b) => (
                    <tr
                      key={b.id}
                      onClick={() => setSelectedBankId(selectedBankId === b.id ? null : b.id)}
                      className={`cursor-pointer border-b border-base-800 text-ink-300 last:border-0 hover:bg-base-800/40 ${
                        selectedBankId === b.id ? "bg-base-800/60" : ""
                      }`}
                    >
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setModalBank(b);
                          }}
                          className="text-ink-500 hover:text-ink-300"
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {scopedBanks.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-3 py-6 text-center text-ink-500">
                        No bank accounts registered. Create them first, then link their ERP account IDs to pull
                        balances automatically.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {reloading && <p className="mt-2 text-[11px] text-ink-500">Refreshing…</p>}
          </WidgetCard>
      </div>

      {selectedBank && (
        <BankDetailPanel
          bank={selectedBank}
          movements={state.movements}
          settlements={state.settlements}
          onEdit={() => setModalBank(selectedBank)}
          onClose={() => setSelectedBankId(null)}
          onRecordMovement={() => setShowMovementModal(true)}
        />
      )}

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
    </div>
  );
}

// Faithful port of the source's trBankDetail() — donut breakdown of the
// physical ERP balance across S&M / Development / Unallocated, the 6-tile
// reconciliation summary, the fund-allocation-postings table and the
// Stripe/Trust Payments settlements table.
function BankDetailPanel({
  bank,
  movements,
  settlements,
  onEdit,
  onClose,
  onRecordMovement,
}: {
  bank: BankRow;
  movements: MovementRow[];
  settlements: SettlementRow[];
  onEdit: () => void;
  onClose: () => void;
  onRecordMovement: () => void;
}) {
  const rows = movements.filter((m) => m.bankAccountId === bank.id);
  const sett = settlements.filter((s) => s.bankAccountId === bank.id);
  const donutData = (Object.keys(bank.allocations) as FundName[])
    .map((fund) => ({ name: fund, value: Math.max(bank.allocations[fund] ?? 0, 0) }))
    .filter((d) => d.value > 0);

  return (
    <div className="mt-4 space-y-4">
      <WidgetCard
        title={`${bank.bank ?? "Bank"} · ${bank.label}`}
        icon={PieChartIcon}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="rounded-full border border-base-700 px-2 py-0.5 text-[11px] text-ink-300 hover:text-ink-50"
            >
              Edit bank
            </button>
            <button
              onClick={onClose}
              className="rounded-full border border-base-700 px-2 py-0.5 text-[11px] text-ink-300 hover:text-ink-50"
            >
              Close
            </button>
          </div>
        }
      >
        <p className="mb-3 text-[11px] text-ink-500">
          {bank.legalEntity ?? "—"} · {bank.currency ?? "—"} · {bank.maskedAccount ?? "Masked account not set"}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="relative">
            {donutData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85}>
                      {donutData.map((d) => (
                        <Cell key={d.name} fill={FUND_COLORS[d.name]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "#1a1a1d", border: "1px solid #232327", fontSize: 11 }}
                      formatter={(value, name) => [formatAmount(Number(value ?? 0), bank.currency), String(name)]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-sm font-semibold text-ink-50">
                    {formatAmount(bank.allocatedTotal, bank.currency)}
                  </span>
                  <span className="text-[10px] text-ink-500">Allocated</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-ink-500">No fund allocations recorded for this account.</p>
            )}
          </div>
          <div className="space-y-1.5 text-xs">
            {(["S&M", "Development", "Unallocated"] as FundName[]).map((f) => (
              <div key={f} className="flex items-center gap-2 text-ink-300">
                <span className="h-2 w-2 rounded-full" style={{ background: FUND_COLORS[f] }} />
                {f} {formatAmount(bank.allocations[f], bank.currency)}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Tile label="Latest ERP balance" value={formatAmount(bank.physicalBalance, bank.currency)} />
          <Tile
            label="Fund reconciliation difference"
            value={formatAmount(bank.reconciliationDifference, bank.currency)}
          />
          <Tile label="Committed known payments" value={formatAmount(bank.commitments, bank.currency)} />
          <Tile label="Allocated less commitments" value={formatAmount(bank.fundedLessCommitments, bank.currency)} />
          <Tile label="Pending processor payouts" value={formatAmount(bank.pendingPayouts, bank.currency)} />
          <Tile label="Snapshot as of" value={formatDate(bank.asOf)} />
        </div>

        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-status-alert/30 bg-status-alert/10 p-2 text-[11px] text-status-alert">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          Projected free cash above is the fund ledger less known mapped obligations, not a guarantee of bank
          availability. Unclassified invoices, missing card statements and unreconciled balances may reduce what
          can be spent.
        </p>
      </WidgetCard>

      <WidgetCard
        title="Fund allocation postings"
        icon={Receipt}
        action={
          <button
            onClick={onRecordMovement}
            className="rounded-full bg-ink-50 px-2 py-0.5 text-[11px] font-medium text-base-950 hover:bg-white"
          >
            + Record movement
          </button>
        }
      >
        <div className="overflow-x-auto rounded-xl border border-base-700">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-base-700 bg-base-900 text-ink-500">
              <tr>
                <th className="px-3 py-2">Date / source UID</th>
                <th className="px-3 py-2">Purpose / reference</th>
                <th className="px-3 py-2">Fund</th>
                <th className="px-3 py-2">Original amount</th>
                <th className="px-3 py-2">Approved by</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.id}-${r.fund}`} className="border-b border-base-800 text-ink-300 last:border-0">
                  <td className="px-3 py-2 text-ink-50">
                    {formatDate(r.txnDate)}
                    <div className="text-[11px] text-ink-500">{r.sourceUid}</div>
                  </td>
                  <td className="px-3 py-2">
                    {r.description || r.transactionType || "—"}
                    <div className="text-[11px] text-ink-500">{r.reference ?? "—"}</div>
                  </td>
                  <td className="px-3 py-2">{r.fund}</td>
                  <td className="px-3 py-2">{formatAmount(r.allocatedAmount, r.currency)}</td>
                  <td className="px-3 py-2">{r.approvedBy ?? "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-ink-500">
                    No allocation postings on this account.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </WidgetCard>

      <WidgetCard title="Stripe & Trust Payments settlements" icon={CreditCard}>
        <div className="overflow-x-auto rounded-xl border border-base-700">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-base-700 bg-base-900 text-ink-500">
              <tr>
                <th className="px-3 py-2">Provider / payout ID</th>
                <th className="px-3 py-2">Expected</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Net bank arrival</th>
                <th className="px-3 py-2">Fund</th>
              </tr>
            </thead>
            <tbody>
              {sett.map((p) => (
                <tr key={p.id} className="border-b border-base-800 text-ink-300 last:border-0">
                  <td className="px-3 py-2 text-ink-50">
                    {p.provider} · {p.payoutId}
                  </td>
                  <td className="px-3 py-2">{formatDate(p.expectedDate)}</td>
                  <td className="px-3 py-2">
                    {p.status}
                    {p.reconciledLedgerId ? " · Reconciled" : ""}
                  </td>
                  <td className="px-3 py-2">{formatAmount(p.net, p.currency)}</td>
                  <td className="px-3 py-2">
                    {p.fund ?? "—"}{" "}
                    <button
                      type="button"
                      title="Settlement reconciliation review is not available in this port yet"
                      className="ml-1 rounded-full border border-base-700 px-1.5 py-0.5 text-[10px] text-ink-500"
                    >
                      Review / reconcile
                    </button>
                  </td>
                </tr>
              ))}
              {sett.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-ink-500">
                    No settlements linked to this bank.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </WidgetCard>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500";

export function BankAccountModal({
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

// Faithful port of the source's trEditor() "movement" form — allocates a
// bank movement to one or more funds via POST /api/finance/treasury/movement.
// Exported so both BanksPage's "+ Record movement" (bank detail drill-down)
// and TreasuryFundsPage's "+ Allocate a bank movement" header action reuse
// one implementation instead of duplicating the form.
export function MovementModal({
  banks,
  onClose,
  onSaved,
}: {
  banks: Pick<BankRow, "id" | "label" | "bank" | "currency">[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [bankAccountId, setBankAccountId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [transactionType, setTransactionType] = useState<string>(MOVEMENT_KINDS[0]);
  const [amount, setAmount] = useState("");
  const [sourceUid, setSourceUid] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [smAmount, setSmAmount] = useState("0");
  const [devAmount, setDevAmount] = useState("0");
  const [unAmount, setUnAmount] = useState("0");
  const [approvedBy, setApprovedBy] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/treasury/movement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankAccountId,
          transactionType,
          amount,
          date,
          sourceUid,
          reference: reference || undefined,
          description: description || undefined,
          approvedBy,
          note: note || undefined,
          allocations: [
            { fund: "S&M", amount: smAmount || 0 },
            { fund: "Development", amount: devAmount || 0 },
            { fund: "Unallocated", amount: unAmount || 0 },
          ],
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to post movement");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-50">Allocate Bank Movement</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="max-h-[70vh] space-y-2.5 overflow-y-auto pr-1">
          <select value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className={inputClass}>
            <option value="">Select bank</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.label} · {b.bank ?? "—"} · {b.currency ?? "—"}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            <select
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value)}
              className={inputClass}
            >
              {MOVEMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Signed amount in bank currency (1000 or -1000)"
              type="number"
              step="any"
              className={inputClass}
            />
            <input
              value={sourceUid}
              onChange={(e) => setSourceUid(e.target.value)}
              placeholder="Bank / ERP transaction UID"
              className={inputClass}
            />
          </div>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Bank reference"
            className={inputClass}
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What was this payment for?"
            className={inputClass}
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              value={smAmount}
              onChange={(e) => setSmAmount(e.target.value)}
              type="number"
              step="any"
              placeholder="S&M allocation"
              className={inputClass}
            />
            <input
              value={devAmount}
              onChange={(e) => setDevAmount(e.target.value)}
              type="number"
              step="any"
              placeholder="Development allocation"
              className={inputClass}
            />
            <input
              value={unAmount}
              onChange={(e) => setUnAmount(e.target.value)}
              type="number"
              step="any"
              placeholder="Unallocated"
              className={inputClass}
            />
          </div>
          <input
            value={approvedBy}
            onChange={(e) => setApprovedBy(e.target.value)}
            placeholder="Finance approver"
            className={inputClass}
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Evidence / notes"
            rows={2}
            className={inputClass}
          />

          {error && (
            <p className="flex items-center gap-1 text-xs text-status-inactive">
              <AlertTriangle className="h-3 w-3" strokeWidth={1.75} /> {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isSaving || !bankAccountId || !amount || !sourceUid.trim() || !approvedBy.trim()}
            className="w-full rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save movement"}
          </button>
          <p className="text-[10px] text-ink-600">Saved to the treasury ledger. No changes posted to the ERP.</p>
        </form>
      </div>
    </div>
  );
}
