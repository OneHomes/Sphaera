"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  RefreshCw,
  AlertTriangle,
  CreditCard,
  Receipt,
  Repeat,
  Landmark,
  CalendarDays,
  Plus,
  Trash2,
  Pencil,
  X,
} from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

// ---------------------------------------------------------------------------
// Types — shapes returned by lib/finance/creditCycleData.ts (projection(),
// listInvoices(), listRecurring(), listCardRules(), listCardCharges()).
// ---------------------------------------------------------------------------

type InvoiceRow = {
  id: string;
  vendor: string;
  invoiceNumber: string | null;
  issueDate: string | Date | null;
  dueDate: string | Date | null;
  amount: number;
  currency: string;
  department: string | null;
  costHead: string | null;
  country: string | null;
  paymentSourceId: string | null;
  status: string;
  paidDate: string | Date | null;
  reference: string | null;
  notes: string | null;
  documentId: string | null;
};

type RecurringRow = {
  id: string;
  title: string;
  category: string;
  beneficiary: string | null;
  country: string | null;
  currency: string;
  amount: number;
  paymentSourceId: string | null;
  recurrenceRule: string;
  dayOfMonth: number | null;
  weekday: number | null;
  ordinal: number | null;
  startDate: string | Date | null;
  endDate: string | Date | null;
  active: boolean;
  notes: string | null;
};

type CashEvent = {
  date: string;
  kind: string;
  label: string;
  amount: number;
  currency: string;
  bankSourceId: string;
  certainty: string;
  reference: string;
};

type CardCycleRow = {
  cardRuleId: string;
  currency: string;
  periodStart: string;
  closingDate: string;
  dueDate: string;
  chargeTotal: number;
  amountDue: number | null;
  estimatedBalanceBeforePayment: number;
  estimatedCarryForward: number;
  paymentKind: string;
  accuracy: string;
  hasStatement: boolean;
  bankSourceId: string;
};

type AccountProjection = {
  sourceId: string;
  account: string;
  currency: string;
  balance: number | null;
  asOf: string | Date | null;
  source: "ERP-reported" | "Manual, unverified" | "No balance";
  bankAccountId: string | null;
  forecastBalance: number | null;
  knownOutflows: number;
  unconverted: number;
};

type ProjectionResult = {
  from: string;
  to: string;
  totalsByCurrency: Record<string, number>;
  events: CashEvent[];
  overdue: CashEvent[];
  cycles: CardCycleRow[];
  accounts: AccountProjection[];
  unassignedCount: number;
  unassignedByCurrency: Record<string, number>;
  limitations: string[];
};

type CardStatement = {
  id: string;
  cardRuleId: string;
  closingDate: string | Date;
  amount: number;
  minimumDue: number | null;
  amountPaid: number;
  status: string;
};

type CardRule = {
  id: string;
  paymentAccountId: string | null;
  statementDay: number;
  dueOffsetDays: number;
  settlement: string;
  statements: CardStatement[];
};

type CardCharge = {
  id: string;
  statementId: string;
  merchant: string | null;
  amount: number;
  currency: string;
  reference: string | null;
};

const INVOICE_STATUSES = ["Unpaid", "Scheduled", "Paid", "Cancelled"];
const RECURRING_CATEGORIES = ["Salary", "Rent", "Tax", "Loan", "Utility", "Subscription", "Other"];
const RECURRENCE_RULES = ["month_end", "last_business_day", "month_start", "day_of_month", "nth_weekday", "last_weekday", "weekly"];
const SETTLEMENT_KINDS = ["Full statement", "Statement minimum"];
const MONTH_OPTIONS = [1, 2, 3, 4, 6, 12, 18];
const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const ORDINAL_NAMES = ["1st", "2nd", "3rd", "4th", "5th"];
const MONTH_TITLES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function fmt(value: number, currency = "USD"): string {
  return `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}
function fmtDate(value: string | Date | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}
function monthTitle(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_TITLES[(m ?? 1) - 1]} ${y}`;
}
function humanizeRecurrence(r: RecurringRow): string {
  const weekday = WEEKDAY_NAMES[r.weekday ?? 3] ?? "Thursday";
  const ordinal = ORDINAL_NAMES[(r.ordinal ?? 1) - 1] ?? "1st";
  switch (r.recurrenceRule) {
    case "month_end":
      return "Last calendar day of the month";
    case "last_business_day":
      return "Last business day of the month";
    case "month_start":
      return "1st of the month";
    case "day_of_month":
      return `Day ${r.dayOfMonth ?? 1} of the month`;
    case "nth_weekday":
      return `${ordinal} ${weekday} of the month`;
    case "last_weekday":
      return `Last ${weekday} of the month`;
    case "weekly":
      return `Weekly on ${weekday}`;
    default:
      return r.recurrenceRule.replace(/_/g, " ");
  }
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-base-700 bg-base-800 p-3">
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink-50">{value}</p>
    </div>
  );
}

function CcKpi({ title, value, detail, small }: { title: string; value: string; detail: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <h4 className="text-[11px] text-ink-500">{title}</h4>
      <div className={`mt-1 font-semibold text-ink-50 ${small ? "text-base" : "text-xl"}`}>{value}</div>
      <div className="mt-1 text-[11px] text-ink-500">{detail}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === "Paid"
      ? "bg-status-active/15 text-status-active"
      : status === "Cancelled"
        ? "bg-status-inactive/15 text-status-inactive"
        : "bg-status-alert/15 text-status-alert";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${style}`}>{status}</span>;
}

function ActivePill({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
        active ? "bg-status-active/15 text-status-active" : "bg-status-inactive/15 text-status-inactive"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function ConfidencePill({ value }: { value: string }) {
  const style =
    value === "Needs actual statement" || value.startsWith("Balance carried")
      ? "bg-status-alert/15 text-status-alert"
      : value === "Statement entered"
        ? "bg-status-active/15 text-status-active"
        : "bg-base-700 text-ink-300";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${style}`}>{value}</span>;
}

const inputClass =
  "w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500";

const TABS = [
  { value: "calendar", label: "Cash calendar" },
  { value: "invoices", label: "Invoices & bills" },
  { value: "payroll", label: "Payroll & recurring" },
  { value: "cards", label: "Cards & Amex" },
  { value: "bank", label: "Bank forecast" },
] as const;
type TabValue = (typeof TABS)[number]["value"];

export function CreditCyclePage({
  invoices: initialInvoices,
  recurring: initialRecurring,
  forecast: initialForecast,
  cardRules: initialCardRules,
  cardCharges: initialCardCharges,
  statements: initialStatements,
  paymentSources,
  canAccessFinancePayroll,
}: {
  invoices: InvoiceRow[];
  recurring: RecurringRow[];
  forecast: ProjectionResult;
  cardRules: CardRule[];
  cardCharges: CardCharge[];
  statements: CardStatement[];
  paymentSources: PaymentSource[];
  canAccessFinancePayroll: boolean;
}) {
  const [statements, setStatements] = useState<CardStatement[]>(initialStatements);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [editingBankLink, setEditingBankLink] = useState<string | "new" | null>(null);
  const sourceById = useMemo(() => new Map(paymentSources.map((s) => [s.id, s])), [paymentSources]);
  const sourceName = (id: string | null | undefined) => (id ? sourceById.get(id)?.name ?? null : null);
  const sourceCurrency = (id: string | null | undefined) => (id ? sourceById.get(id)?.currency ?? "" : "");
  function cardName(ruleId: string): string {
    const rule = cardRules.find((r) => r.id === ruleId);
    return sourceName(rule?.paymentAccountId) ?? `Card cycle ${ruleId.slice(0, 8)}`;
  }
  async function reloadStatementsAndCharges() {
    const [s, c] = await Promise.all([fetch("/api/finance/credit/card-statements"), fetch("/api/finance/credit/card-charges")]);
    if (s.ok) setStatements((await s.json()).statements ?? []);
    if (c.ok) setCardCharges((await c.json()).charges ?? []);
  }
  const [invoices, setInvoices] = useState<InvoiceRow[]>(initialInvoices);
  const [recurring, setRecurring] = useState<RecurringRow[]>(initialRecurring);
  const [forecast, setForecast] = useState<ProjectionResult>(initialForecast);
  const [cardRules, setCardRules] = useState<CardRule[]>(initialCardRules);
  const [cardCharges, setCardCharges] = useState<CardCharge[]>(initialCardCharges);
  const [tab, setTab] = useState<TabValue>("calendar");
  const [startDate, setStartDate] = useState(initialForecast.from);
  const [months, setMonths] = useState(4);
  const [refreshing, setRefreshing] = useState(false);

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRow | null>(null);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringRow | null>(null);
  const [showCardRuleModal, setShowCardRuleModal] = useState(false);
  const [editingCardRule, setEditingCardRule] = useState<CardRule | null>(null);

  async function refreshForecast(nextStart = startDate, nextMonths = months) {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/finance/credit/forecast?start=${encodeURIComponent(nextStart)}&months=${nextMonths}`);
      if (res.ok) setForecast(await res.json());
    } finally {
      setRefreshing(false);
    }
  }

  async function reloadInvoices() {
    const res = await fetch("/api/finance/credit/invoices");
    if (res.ok) setInvoices((await res.json()).invoices ?? []);
  }
  async function reloadRecurring() {
    const res = await fetch("/api/finance/credit/recurring");
    if (res.ok) setRecurring((await res.json()).recurring ?? []);
  }
  async function reloadCardRules() {
    const res = await fetch("/api/finance/credit/card-rules");
    if (res.ok) setCardRules((await res.json()).cardRules ?? []);
  }

  async function handleDeleteInvoice(id: string) {
    if (!confirm("Delete this invoice?")) return;
    const res = await fetch(`/api/finance/credit/invoices/${id}`, { method: "DELETE" });
    if (res.ok) setInvoices((prev) => prev.filter((i) => i.id !== id));
    else alert((await res.json().catch(() => null))?.error ?? "Failed to delete invoice");
  }
  async function handleDeleteRecurring(id: string) {
    if (!confirm("Delete this recurring obligation?")) return;
    const res = await fetch(`/api/finance/credit/recurring/${id}`, { method: "DELETE" });
    if (res.ok) setRecurring((prev) => prev.filter((r) => r.id !== id));
    else alert((await res.json().catch(() => null))?.error ?? "Failed to delete recurring obligation");
  }

  const accountsBySourceId = useMemo(() => new Map(forecast.accounts.map((a) => [a.sourceId, a])), [forecast.accounts]);
  function bankLabel(id: string | null | undefined): string {
    if (!id) return "Not assigned";
    return accountsBySourceId.get(id)?.account ?? id;
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const unpaidInvoices = invoices.filter((i) => i.status === "Unpaid" || i.status === "Scheduled");
  const overdueInvoiceCount = unpaidInvoices.filter((i) => i.dueDate && new Date(i.dueDate).toISOString().slice(0, 10) < todayIso).length;
  const activeRecurringCount = recurring.filter((r) => r.active).length;

  const monthGroups = useMemo(() => {
    const map = new Map<string, CashEvent[]>();
    for (const e of forecast.events) {
      const key = e.date.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
  }, [forecast.events]);

  const needsStatementCycles = forecast.cycles.filter((c) => c.accuracy === "Needs actual statement");
  const negativeAccounts = forecast.accounts.filter((a) => a.forecastBalance !== null && a.forecastBalance < 0);

  const currencyEntries = Object.entries(forecast.totalsByCurrency);

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink-50">Credit cycle management</h2>
          <p className="mt-1 text-sm text-ink-500">
            Payment obligations, payroll dates, card statements and projected cash requirements.
          </p>
        </div>
        <button
          onClick={() => refreshForecast()}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-base-700 px-3 py-2 text-xs font-medium text-ink-300 hover:bg-base-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} strokeWidth={1.75} />
          Refresh projections
        </button>
      </div>

      <div className="mb-4 rounded-lg border border-status-alert/40 bg-status-alert/10 p-3 text-[11px] text-status-alert">
        This is a cash planning tool, not the bank ledger. Card purchases are forecast on their statement payment
        date, not charged as bank outflows twice. No ERP bank or Amex feeds are connected yet. Historical rates and
        salary records must be verified before relying on the forecast.
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CcKpi
          title="Scheduled cash outflows"
          value={currencyEntries.map(([c, n]) => fmt(n, c)).join(" · ") || "No scheduled payments yet"}
          detail="Selected projection window, separated by currency"
          small
        />
        <CcKpi title="Unpaid invoices" value={String(unpaidInvoices.length)} detail={`${forecast.overdue.length} overdue commitments`} />
        <CcKpi title="Recurring obligations" value={String(activeRecurringCount)} detail="Employee salaries, rent, utilities and other rules" />
        <CcKpi title="Configured card cycles" value={String(cardRules.length)} detail="Statement cutoff, payment due and settlement account" />
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3 rounded-xl border border-base-700 bg-base-900 p-4">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                tab === t.value ? "border-ink-50 bg-ink-50 text-base-950" : "border-base-700 text-ink-300 hover:text-ink-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-ink-500">
            Forecast from
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs normal-case text-ink-50 outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-ink-500">
            Forecast horizon
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs normal-case text-ink-50 outline-none"
            >
              {MONTH_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} month{m === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => refreshForecast(startDate, months)}
            disabled={refreshing}
            className="rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </div>

      <div className="mt-4">
        {tab === "calendar" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink-50">Upcoming cash calendar</h2>
                <p className="mt-1 text-xs text-ink-500">What is due, when it falls due and which bank account is expected to pay.</p>
              </div>
              <button
                onClick={() => {
                  setEditingInvoice(null);
                  setShowInvoiceModal(true);
                }}
                className="flex items-center gap-1 rounded-lg border border-status-active/50 px-3 py-1.5 text-xs font-medium text-status-active hover:bg-status-active/10"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.75} /> Add invoice
              </button>
            </div>
            {forecast.overdue.length > 0 && (
              <div className="rounded-lg border border-status-inactive/40 bg-status-inactive/10 p-3 text-xs text-status-inactive">
                <b>{forecast.overdue.length} overdue commitments</b> require attention.{" "}
                {Object.entries(
                  forecast.overdue.reduce<Record<string, number>>((a, e) => ((a[e.currency] = (a[e.currency] ?? 0) + e.amount), a), {})
                )
                  .map(([k, v]) => fmt(v, k))
                  .join(" · ")}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {monthGroups.map(([key, events]) => {
                const totalsByCurrency = new Map<string, number>();
                for (const e of events) totalsByCurrency.set(e.currency, (totalsByCurrency.get(e.currency) ?? 0) + e.amount);
                return (
                  <div key={key} className="rounded-xl border border-base-700 bg-base-900 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-xs font-medium text-ink-50">{monthTitle(key)}</h4>
                      <span className="text-[11px] text-ink-500">
                        {Array.from(totalsByCurrency.entries())
                          .map(([c, v]) => fmt(v, c))
                          .join(" · ")}
                      </span>
                    </div>
                    <ul className="space-y-1 text-[11px] text-ink-300">
                      {events.slice(0, 6).map((e, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 border-b border-base-800 pb-1 last:border-0">
                          <span className="truncate">
                            {fmtDate(e.date)} · {e.label}
                          </span>
                          <span className="shrink-0 text-ink-50">{fmt(e.amount, e.currency)}</span>
                        </li>
                      ))}
                    </ul>
                    {events.length > 6 && (
                      <p className="mt-1 text-[10px] text-ink-500">+{events.length - 6} more in {monthTitle(key)}</p>
                    )}
                  </div>
                );
              })}
            </div>
            {monthGroups.length === 0 && (
              <div className="rounded-xl border border-base-700 bg-base-900 p-4 text-sm text-ink-300">
                No confirmed cash payments scheduled yet. Add bills and payroll rules to build your projection.
              </div>
            )}

            <div className="rounded-xl border border-base-700 bg-base-900 p-4">
              <h3 className="mb-2 text-sm font-medium text-ink-50">CEO cash-cycle observations</h3>
              <div className="space-y-2 text-xs">
                {forecast.overdue.length > 0 && (
                  <p className="rounded-lg border border-status-inactive/40 bg-status-inactive/10 p-2 text-status-inactive">
                    Prioritise settling or disputing {forecast.overdue.length} overdue obligations.
                  </p>
                )}
                {forecast.unassignedCount > 0 && (
                  <p className="rounded-lg border border-status-alert/40 bg-status-alert/10 p-2 text-status-alert">
                    Assign paying bank accounts for {forecast.unassignedCount} scheduled outflows before relying on
                    bank-level liquidity.
                  </p>
                )}
                {needsStatementCycles.length > 0 && (
                  <p className="rounded-lg border border-status-alert/40 bg-status-alert/10 p-2 text-status-alert">
                    Some Amex/card payment amounts cannot be established. Upload or enter their statements before
                    treating the forecast as a full cash plan.
                  </p>
                )}
                {negativeAccounts.length > 0 && (
                  <p className="rounded-lg border border-status-inactive/40 bg-status-inactive/10 p-2 text-status-inactive">
                    Some accounts could fall below zero from the <b>known</b> commitments alone. Finance should check
                    the timing of supplier payments and expected collections.
                  </p>
                )}
                {forecast.overdue.length === 0 && forecast.unassignedCount === 0 && needsStatementCycles.length === 0 && (
                  <p className="text-[11px] text-ink-500">
                    Check upcoming supplier payments against collections timing and preserve headroom ahead of card
                    statement due dates.
                  </p>
                )}
              </div>
            </div>

            <WidgetCard title="All upcoming bills and payments, drill into dates and amounts" icon={CalendarDays}>
              <div className="overflow-x-auto rounded-xl border border-base-700">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                    <tr>
                      <th className="px-3 py-2">Due date</th>
                      <th className="px-3 py-2">Commitment</th>
                      <th className="px-3 py-2">Reference / notes</th>
                      <th className="px-3 py-2">Currency</th>
                      <th className="px-3 py-2">Cash out</th>
                      <th className="px-3 py-2">Payment bank</th>
                      <th className="px-3 py-2">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.events.map((e, i) => (
                      <tr key={i} className="border-b border-base-800 text-ink-300 last:border-0">
                        <td className="px-3 py-2 text-ink-50">{fmtDate(e.date)}</td>
                        <td className="px-3 py-2">{e.label}</td>
                        <td className="px-3 py-2">{e.reference || "—"}</td>
                        <td className="px-3 py-2">{e.currency}</td>
                        <td className="px-3 py-2">{fmt(e.amount, e.currency)}</td>
                        <td className="px-3 py-2">{bankLabel(e.bankSourceId)}</td>
                        <td className="px-3 py-2">
                          <ConfidencePill value={e.certainty} />
                        </td>
                      </tr>
                    ))}
                    {forecast.events.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-6 text-center text-ink-500">
                          No payments currently due for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </WidgetCard>
            {Object.keys(forecast.unassignedByCurrency ?? {}).length > 0 && (
              <div className="rounded-lg border border-status-alert/40 bg-status-alert/10 p-3 text-xs text-status-alert">
                <b>Unassigned paying account:</b>{" "}
                {Object.entries(forecast.unassignedByCurrency)
                  .map(([k, v]) => fmt(v, k))
                  .join(" · ")}
                . Map a bank account to these obligations for meaningful bank-level forecasts.
              </div>
            )}
          </div>
        )}

        {tab === "invoices" && (
          <div className="space-y-4">
            <SectionHead
              title="Invoice obligations"
              text="Upload supporting PDF or image and record invoice amount, currency, due date and payment source."
            >
              <PrimaryButton
                onClick={() => {
                  setEditingInvoice(null);
                  setShowInvoiceModal(true);
                }}
              >
                New invoice
              </PrimaryButton>
            </SectionHead>

            <div className="rounded-xl border border-base-700 bg-base-900 p-4">
              <EventsTable
                events={[...invoices]
                  .filter((x) => x.status === "Unpaid" || x.status === "Scheduled")
                  .sort((a, b) => String(a.dueDate ?? "").localeCompare(String(b.dueDate ?? "")))
                  .map((x) => ({
                    date: x.dueDate ? new Date(x.dueDate).toISOString().slice(0, 10) : "",
                    kind: "Invoice",
                    label: x.vendor,
                    reference: x.invoiceNumber ?? "",
                    amount: x.amount,
                    currency: x.currency,
                    bankSourceId: x.paymentSourceId ?? "",
                    certainty: x.status,
                  }))}
                bankLabel={bankLabel}
              />
            </div>

            <div className="rounded-xl border border-base-700 bg-base-900 p-4">
              <h3 className="mb-3 text-sm font-medium text-ink-50">Manage invoices</h3>
              <div className="overflow-x-auto rounded-xl border border-base-700">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                    <tr>
                      <th className="px-3 py-2">Invoice</th>
                      <th className="px-3 py-2">Due</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Evidence</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...invoices]
                      .sort((a, b) => String(a.dueDate ?? "").localeCompare(String(b.dueDate ?? "")))
                      .map((inv) => (
                        <tr key={inv.id} className="border-b border-base-800 text-ink-300 last:border-0">
                          <td className="px-3 py-2">
                            <b className="text-ink-50">{inv.vendor}</b>
                            <div className="text-[11px] text-ink-500">{inv.invoiceNumber || "No invoice number"}</div>
                          </td>
                          <td className="px-3 py-2">{fmtDate(inv.dueDate)}</td>
                          <td className="px-3 py-2">{fmt(inv.amount, inv.currency)}</td>
                          <td className="px-3 py-2">
                            <StatusBadge status={inv.status} />
                          </td>
                          <td className="px-3 py-2">
                            {inv.documentId ? (
                              <a href={`/api/documents/${inv.documentId}/download`} target="_blank" rel="noreferrer" className="text-ink-300 underline hover:text-ink-50">
                                View document
                              </a>
                            ) : (
                              <span className="text-ink-500">Missing document</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex justify-end gap-2">
                              <SmallButton
                                onClick={() => {
                                  setEditingInvoice(inv);
                                  setShowInvoiceModal(true);
                                }}
                              >
                                Review / edit
                              </SmallButton>
                              <button onClick={() => handleDeleteInvoice(inv.id)} className="text-ink-500 hover:text-status-inactive" title="Delete invoice">
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {invoices.length === 0 && <p className="px-3 py-6 text-center text-xs text-ink-500">No invoices recorded yet.</p>}
              </div>
            </div>
          </div>
        )}

        {tab === "payroll" && (
          <div className="space-y-4">
            <SectionHead
              title="Payday and recurring obligations"
              text="One entry per employee or contract, with the local country and its actual payment-day logic."
            >
              <PrimaryButton
                onClick={() => {
                  setEditingRecurring(null);
                  setShowRecurringModal(true);
                }}
              >
                Add recurring payment
              </PrimaryButton>
            </SectionHead>
            <div className="rounded-lg border border-base-700 bg-base-900 p-3 text-xs text-ink-300">
              Examples: <b className="text-ink-50">UK salaries, last business day</b>,{" "}
              <b className="text-ink-50">US salaries, first Thursday</b>, <b className="text-ink-50">Pakistan salaries, day 1</b>.
              Weekends are handled for last-business-day rules. Country-specific public holidays are not automatically
              adjusted and must be confirmed by Finance.
            </div>
            <div className="rounded-xl border border-base-700 bg-base-900 p-4">
              <div className="overflow-x-auto rounded-xl border border-base-700">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                    <tr>
                      <th className="px-3 py-2">Obligation</th>
                      <th className="px-3 py-2">Person / supplier</th>
                      <th className="px-3 py-2">Country</th>
                      <th className="px-3 py-2">Schedule</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Pay from</th>
                      <th className="px-3 py-2">Active</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...recurring]
                      .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title))
                      .map((r) => (
                        <tr key={r.id} className="border-b border-base-800 text-ink-300 last:border-0">
                          <td className="px-3 py-2">
                            <b className="text-ink-50">{r.title}</b>
                            <div className="text-[11px] text-ink-500">{r.category}</div>
                          </td>
                          <td className="px-3 py-2">{r.beneficiary || "Not assigned"}</td>
                          <td className="px-3 py-2">{r.country || "Not set"}</td>
                          <td className="px-3 py-2">{humanizeRecurrence(r)}</td>
                          <td className="px-3 py-2">{fmt(r.amount, r.currency)}</td>
                          <td className="px-3 py-2">{sourceName(r.paymentSourceId) ?? "Unassigned"}</td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                r.active ? "bg-status-active/15 text-status-active" : "bg-base-700 text-ink-300"
                              }`}
                            >
                              {r.active ? "Active" : "Paused"}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex justify-end gap-2">
                              <SmallButton
                                disabled={r.category === "Salary" && !canAccessFinancePayroll}
                                onClick={() => {
                                  setEditingRecurring(r);
                                  setShowRecurringModal(true);
                                }}
                              >
                                Edit
                              </SmallButton>
                              <button
                                onClick={() => handleDeleteRecurring(r.id)}
                                disabled={r.category === "Salary" && !canAccessFinancePayroll}
                                className="text-ink-500 hover:text-status-inactive disabled:opacity-40"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {recurring.length === 0 && <p className="px-3 py-6 text-center text-xs text-ink-500">No recurring payment rules yet.</p>}
              </div>
            </div>
          </div>
        )}

        {tab === "cards" && (
          <div className="space-y-4">
            <SectionHead
              title="Card and Amex billing cycles"
              text="Statements close on a cutoff date. Purchases after cutoff enter the next statement, regardless of when the current bill is due."
            >
              <Link
                href="/finance/traceability"
                className="flex items-center gap-1 rounded-lg border border-status-active/50 px-3 py-1.5 text-xs font-medium text-status-active hover:bg-status-active/10"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.75} /> Register card
              </Link>
              <PrimaryButton
                onClick={() => {
                  setEditingCardRule(null);
                  setShowCardRuleModal(true);
                }}
              >
                Configure cycle
              </PrimaryButton>
            </SectionHead>
            <div className="rounded-lg border border-status-alert/40 bg-status-alert/10 p-3 text-xs text-status-alert">
              The <b>minimum amount due</b> is not the value of the charges made within the cycle. Enter the{" "}
              <b>actual statement balance and minimum due</b> from Amex to obtain a reliable payment obligation. Without a
              statement, a full-settlement card shows only an estimated amount based on linked charges. A minimum-payment
              card remains <b>Unknown</b> until its statement is supplied.
            </div>

            <div className="rounded-xl border border-base-700 bg-base-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-ink-50">Registered card billing rules</h3>
                <SmallButton onClick={() => setShowChargeModal(true)}>+ Record missing card charge</SmallButton>
              </div>
              <div className="overflow-x-auto rounded-xl border border-base-700">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                    <tr>
                      <th className="px-3 py-2">Card</th>
                      <th className="px-3 py-2">Statement closes</th>
                      <th className="px-3 py-2">Due after close</th>
                      <th className="px-3 py-2">Settlement rule</th>
                      <th className="px-3 py-2">Paid from</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cardRules.map((rule) => (
                      <tr key={rule.id} className="border-b border-base-800 text-ink-300 last:border-0">
                        <td className="px-3 py-2">
                          <b className="text-ink-50">{cardName(rule.id)}</b> {sourceCurrency(rule.paymentAccountId)}
                        </td>
                        <td className="px-3 py-2">Day {rule.statementDay} of month</td>
                        <td className="px-3 py-2">{rule.dueOffsetDays} days</td>
                        <td className="px-3 py-2">{rule.settlement}</td>
                        <td className="px-3 py-2">{sourceName(rule.paymentAccountId) ?? "No account"}</td>
                        <td className="px-3 py-2 text-right">
                          <SmallButton
                            onClick={() => {
                              setEditingCardRule(rule);
                              setShowCardRuleModal(true);
                            }}
                          >
                            Edit
                          </SmallButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl border border-base-700 bg-base-900 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-ink-50">Statement cycles and projected settlement dates</h3>
                <PrimaryButton small onClick={() => setShowStatementModal(true)}>
                  Enter Amex statement
                </PrimaryButton>
              </div>
              <div className="overflow-x-auto rounded-xl border border-base-700">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                    <tr>
                      <th className="px-3 py-2">Card</th>
                      <th className="px-3 py-2">Statement period</th>
                      <th className="px-3 py-2">Closes</th>
                      <th className="px-3 py-2">Payment due</th>
                      <th className="px-3 py-2">Charges recorded</th>
                      <th className="px-3 py-2">Amount payable</th>
                      <th className="px-3 py-2">Rollover / outstanding</th>
                      <th className="px-3 py-2">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.cycles.map((c, i) => (
                      <tr key={i} className="border-b border-base-800 text-ink-300 last:border-0">
                        <td className="px-3 py-2">
                          <b className="text-ink-50">{cardName(c.cardRuleId)}</b>
                        </td>
                        <td className="px-3 py-2">
                          {fmtDate(c.periodStart)} to {fmtDate(c.closingDate)}
                        </td>
                        <td className="px-3 py-2">{fmtDate(c.closingDate)}</td>
                        <td className="px-3 py-2">{fmtDate(c.dueDate)}</td>
                        <td className="px-3 py-2">{fmt(c.chargeTotal, c.currency)}</td>
                        <td className="px-3 py-2">
                          <b className="text-ink-50">{c.amountDue === null ? "Await statement" : fmt(c.amountDue, c.currency)}</b>
                          <div className="text-[11px] text-ink-500">{c.paymentKind}</div>
                        </td>
                        <td className="px-3 py-2">
                          {fmt(c.estimatedCarryForward, c.currency)}
                          <div className="text-[11px] text-ink-500">Estimate, excluding interest</div>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              c.hasStatement ? "bg-status-active/15 text-status-active" : "bg-status-alert/15 text-status-alert"
                            }`}
                          >
                            {c.accuracy}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {forecast.cycles.length === 0 && (
                  <p className="px-3 py-6 text-center text-xs text-ink-500">Set up a card cutoff date to generate its payment-cycle calendar.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-base-700 bg-base-900 p-4">
              <h3 className="mb-3 text-sm font-medium text-ink-50">Manual card charges</h3>
              <div className="overflow-x-auto rounded-xl border border-base-700">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                    <tr>
                      <th className="px-3 py-2">Statement</th>
                      <th className="px-3 py-2">Card</th>
                      <th className="px-3 py-2">Merchant</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cardCharges.map((c) => {
                      const st = statements.find((s) => s.id === c.statementId);
                      return (
                        <tr key={c.id} className="border-b border-base-800 text-ink-300 last:border-0">
                          <td className="px-3 py-2">{st ? `Closes ${fmtDate(st.closingDate)}` : "—"}</td>
                          <td className="px-3 py-2">{st ? cardName(st.cardRuleId) : "—"}</td>
                          <td className="px-3 py-2 text-ink-50">{c.merchant ?? "—"}</td>
                          <td className="px-3 py-2">{fmt(c.amount, c.currency)}</td>
                          <td className="px-3 py-2">{c.reference ?? ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "bank" && (
          <div className="space-y-4">
            <SectionHead
              title="Projected account balances"
              text="ERP-sourced or manually entered opening balances less known scheduled outgoings."
            >
              <PrimaryButton onClick={() => setEditingBankLink("new")}>Map bank balance</PrimaryButton>
            </SectionHead>
            <div className="rounded-lg border border-status-alert/40 bg-status-alert/10 p-3 text-xs text-status-alert">
              Balances are not independently verified. A missing or stale ERP balance is <b>not</b> zero. Future incoming
              collections, unknown invoices, currency conversions and card settlements without a paying account are not
              included.
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {forecast.accounts.map((x) => (
                <div key={x.sourceId} className="rounded-xl border border-base-700 bg-base-900 p-4">
                  <h4 className="text-[11px] text-ink-500">{x.account}</h4>
                  <div className="mt-1 text-base font-semibold text-ink-50">
                    {x.forecastBalance === null ? "Unknown" : fmt(x.forecastBalance, x.currency)}
                  </div>
                  <div className="mt-1 space-y-0.5 text-[11px] text-ink-500">
                    <div>
                      Opening: {x.balance === null ? "Unknown" : fmt(x.balance, x.currency)} · {x.source}
                    </div>
                    <div>Snapshot {x.asOf ? fmtDate(x.asOf) : "missing"}</div>
                    <div>Known debits {fmt(x.knownOutflows, x.currency)}</div>
                    {x.unconverted > 0 && <span className="text-status-inactive">{x.unconverted} outflows need FX</span>}
                  </div>
                  <div className="mt-2">
                    <SmallButton onClick={() => setEditingBankLink(x.sourceId)}>Edit source</SmallButton>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-base-700 bg-base-900 p-4">
              <h3 className="mb-3 text-sm font-medium text-ink-50">Bank mapping and balance source</h3>
              <div className="overflow-x-auto rounded-xl border border-base-700">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                    <tr>
                      <th className="px-3 py-2">Account</th>
                      <th className="px-3 py-2">Currency</th>
                      <th className="px-3 py-2">Balance source</th>
                      <th className="px-3 py-2">As-of date</th>
                      <th className="px-3 py-2">Opening balance</th>
                      <th className="px-3 py-2">Projected balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.accounts.map((x) => (
                      <tr key={x.sourceId} className="border-b border-base-800 text-ink-300 last:border-0">
                        <td className="px-3 py-2">
                          <b className="text-ink-50">{x.account}</b>
                        </td>
                        <td className="px-3 py-2">{x.currency}</td>
                        <td className="px-3 py-2">{x.source}</td>
                        <td className="px-3 py-2">{x.asOf ? fmtDate(x.asOf) : "Not available"}</td>
                        <td className="px-3 py-2">{x.balance === null ? "Unknown" : fmt(x.balance, x.currency)}</td>
                        <td className="px-3 py-2">{x.forecastBalance === null ? "Unknown" : fmt(x.forecastBalance, x.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="mt-5 text-[11px] text-ink-500">
        Forecast totals do not include unconfirmed sales receipts or all future purchases. Mixed currencies are
        intentionally not combined. Bank shortages require confirmation against the actual bank and the complete
        payment schedule.
      </p>

      {showInvoiceModal && (
        <InvoiceModal
          invoice={editingInvoice}
          onClose={() => setShowInvoiceModal(false)}
          onSaved={async () => {
            setShowInvoiceModal(false);
            await reloadInvoices();
            await refreshForecast();
          }}
        />
      )}
      {showRecurringModal && (
        <RecurringModal
          recurring={editingRecurring}
          canAccessFinancePayroll={canAccessFinancePayroll}
          onClose={() => setShowRecurringModal(false)}
          onSaved={async () => {
            setShowRecurringModal(false);
            await reloadRecurring();
            await refreshForecast();
          }}
        />
      )}
      {showStatementModal && (
        <CardStatementModal
          cardRules={cardRules}
          cardName={cardName}
          onClose={() => setShowStatementModal(false)}
          onSaved={async () => {
            setShowStatementModal(false);
            await reloadStatementsAndCharges();
            await refreshForecast();
          }}
        />
      )}
      {showChargeModal && (
        <CardChargeModal
          statements={statements}
          cardName={cardName}
          onClose={() => setShowChargeModal(false)}
          onSaved={async () => {
            setShowChargeModal(false);
            await reloadStatementsAndCharges();
            await refreshForecast();
          }}
        />
      )}
      {editingBankLink && (
        <BankLinkModal
          sources={paymentSources}
          initialSourceId={editingBankLink === "new" ? null : editingBankLink}
          onClose={() => setEditingBankLink(null)}
          onSaved={async () => {
            setEditingBankLink(null);
            await refreshForecast();
          }}
        />
      )}
      {showCardRuleModal && (
        <CardRuleModal
          rule={editingCardRule}
          onClose={() => setShowCardRuleModal(false)}
          onSaved={async () => {
            setShowCardRuleModal(false);
            await reloadCardRules();
            await refreshForecast();
          }}
        />
      )}
    </div>
  );
}

function InvoiceModal({
  invoice,
  onClose,
  onSaved,
}: {
  invoice: InvoiceRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [vendor, setVendor] = useState(invoice?.vendor ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(invoice?.invoiceNumber ?? "");
  const [dueDate, setDueDate] = useState(invoice?.dueDate ? new Date(invoice.dueDate).toISOString().slice(0, 10) : "");
  const [amount, setAmount] = useState(invoice ? String(invoice.amount) : "");
  const [currency, setCurrency] = useState(invoice?.currency ?? "USD");
  const [department, setDepartment] = useState(invoice?.department ?? "");
  const [status, setStatus] = useState(invoice?.status ?? "Unpaid");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const url = invoice ? `/api/finance/credit/invoices/${invoice.id}` : "/api/finance/credit/invoices";
      const res = await fetch(url, {
        method: invoice ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor,
          invoiceNumber: invoiceNumber || undefined,
          dueDate,
          amount: Number(amount),
          currency,
          department: department || undefined,
          status,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to save invoice");
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
          <h2 className="text-sm font-medium text-ink-50">{invoice ? "Review invoice" : "New invoice"}</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Supplier / vendor" className={inputClass} />
          <div className="flex gap-2">
            <input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Invoice number (optional)"
              className={inputClass}
            />
            <input value={dueDate} onChange={(e) => setDueDate(e.target.value)} type="date" className={inputClass} />
          </div>
          <div className="flex gap-2">
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" type="number" className={inputClass} />
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              placeholder="Currency"
              maxLength={3}
              className={inputClass}
            />
          </div>
          <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Department (optional)" className={inputClass} />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
            {INVOICE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {error && <p className="text-xs text-status-inactive">{error}</p>}
          <button
            type="submit"
            disabled={isSaving || !vendor.trim() || !dueDate || !amount}
            className="w-full rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
          >
            {isSaving ? "Saving…" : invoice ? "Save changes" : "Create invoice"}
          </button>
        </form>
      </div>
    </div>
  );
}

function RecurringModal({
  recurring,
  canAccessFinancePayroll,
  onClose,
  onSaved,
}: {
  recurring: RecurringRow | null;
  canAccessFinancePayroll: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(recurring?.title ?? "");
  const [category, setCategory] = useState(recurring?.category ?? "Rent");
  const [beneficiary, setBeneficiary] = useState(recurring?.beneficiary ?? "");
  const [amount, setAmount] = useState(recurring ? String(recurring.amount) : "");
  const [currency, setCurrency] = useState(recurring?.currency ?? "USD");
  const [recurrenceRule, setRecurrenceRule] = useState(recurring?.recurrenceRule ?? "month_end");
  const [dayOfMonth, setDayOfMonth] = useState(String(recurring?.dayOfMonth ?? 1));
  const [startDate, setStartDate] = useState(recurring?.startDate ? new Date(recurring.startDate).toISOString().slice(0, 10) : "");
  const [active, setActive] = useState(recurring?.active ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const url = recurring ? `/api/finance/credit/recurring/${recurring.id}` : "/api/finance/credit/recurring";
      const res = await fetch(url, {
        method: recurring ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category,
          beneficiary: beneficiary || undefined,
          amount: Number(amount),
          currency,
          recurrenceRule,
          dayOfMonth: recurrenceRule === "day_of_month" ? Number(dayOfMonth) : undefined,
          startDate,
          active,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to save recurring obligation");
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
          <h2 className="text-sm font-medium text-ink-50">{recurring ? "Edit recurring payment" : "New recurring payment"}</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Payment title" className={inputClass} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
            {RECURRING_CATEGORIES.map((c) => (
              <option key={c} value={c} disabled={c === "Salary" && !canAccessFinancePayroll}>
                {c}
                {c === "Salary" && !canAccessFinancePayroll ? " (requires payroll access)" : ""}
              </option>
            ))}
          </select>
          <input value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} placeholder="Beneficiary (optional)" className={inputClass} />
          <div className="flex gap-2">
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" type="number" className={inputClass} />
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              placeholder="Currency"
              maxLength={3}
              className={inputClass}
            />
          </div>
          <select value={recurrenceRule} onChange={(e) => setRecurrenceRule(e.target.value)} className={inputClass}>
            {RECURRENCE_RULES.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          {recurrenceRule === "day_of_month" && (
            <input
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(e.target.value)}
              placeholder="Day of month (1-31)"
              type="number"
              className={inputClass}
            />
          )}
          <input value={startDate} onChange={(e) => setStartDate(e.target.value)} type="date" className={inputClass} />
          <label className="flex items-center gap-2 text-xs text-ink-300">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
          </label>
          {error && <p className="text-xs text-status-inactive">{error}</p>}
          <button
            type="submit"
            disabled={isSaving || !title.trim() || !amount || !startDate || (category === "Salary" && !canAccessFinancePayroll)}
            className="w-full rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
          >
            {isSaving ? "Saving…" : recurring ? "Save changes" : "Create recurring payment"}
          </button>
        </form>
      </div>
    </div>
  );
}

function CardRuleModal({
  rule,
  onClose,
  onSaved,
}: {
  rule: CardRule | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [statementDay, setStatementDay] = useState(String(rule?.statementDay ?? 25));
  const [dueOffsetDays, setDueOffsetDays] = useState(String(rule?.dueOffsetDays ?? 21));
  const [settlement, setSettlement] = useState(rule?.settlement ?? SETTLEMENT_KINDS[0]);
  const [paymentAccountId, setPaymentAccountId] = useState(rule?.paymentAccountId ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/credit/card-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: rule?.id,
          paymentAccountId: paymentAccountId || undefined,
          statementDay: Number(statementDay),
          dueOffsetDays: Number(dueOffsetDays),
          settlement,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to save card cycle");
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
          <h2 className="text-sm font-medium text-ink-50">{rule ? "Edit card cycle" : "Add card cycle"}</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div className="flex gap-2">
            <input
              value={statementDay}
              onChange={(e) => setStatementDay(e.target.value)}
              placeholder="Statement closing day (1-31)"
              type="number"
              className={inputClass}
            />
            <input
              value={dueOffsetDays}
              onChange={(e) => setDueOffsetDays(e.target.value)}
              placeholder="Days until due"
              type="number"
              className={inputClass}
            />
          </div>
          <select value={settlement} onChange={(e) => setSettlement(e.target.value)} className={inputClass}>
            {SETTLEMENT_KINDS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            value={paymentAccountId}
            onChange={(e) => setPaymentAccountId(e.target.value)}
            placeholder="Settlement bank payment-source ID (optional)"
            className={inputClass}
          />
          <p className="text-[10px] text-ink-500">
            Leave the payment source blank until the settlement bank account is registered under Banks.
          </p>
          {error && <p className="text-xs text-status-inactive">{error}</p>}
          <button
            type="submit"
            disabled={isSaving || !statementDay || !dueOffsetDays}
            className="w-full rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
          >
            {isSaving ? "Saving…" : rule ? "Save changes" : "Create card cycle"}
          </button>
        </form>
      </div>
    </div>
  );
}

type PaymentSource = { id: string; name: string; kind: string; currency: string | null };

function SectionHead({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-ink-50">{title}</h2>
        <p className="mt-1 text-xs text-ink-500">{text}</p>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

function PrimaryButton({ onClick, children, small }: { onClick: () => void; children: React.ReactNode; small?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-lg bg-ink-50 font-medium text-base-950 hover:bg-white ${small ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"}`}
    >
      <Plus className="h-3.5 w-3.5" strokeWidth={1.75} /> {children}
    </button>
  );
}

function SmallButton({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-base-700 px-2.5 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function EventsTable({ events, bankLabel }: { events: CashEvent[]; bankLabel: (id: string) => string }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-base-700">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-base-700 bg-base-900 text-ink-500">
          <tr>
            <th className="px-3 py-2">Due date</th>
            <th className="px-3 py-2">Commitment</th>
            <th className="px-3 py-2">Reference / notes</th>
            <th className="px-3 py-2">Currency</th>
            <th className="px-3 py-2">Cash out</th>
            <th className="px-3 py-2">Payment bank</th>
            <th className="px-3 py-2">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e, i) => (
            <tr key={i} className="border-b border-base-800 text-ink-300 last:border-0">
              <td className="px-3 py-2 text-ink-50">{fmtDate(e.date)}</td>
              <td className="px-3 py-2">{e.label}</td>
              <td className="px-3 py-2">{e.reference || "—"}</td>
              <td className="px-3 py-2">{e.currency}</td>
              <td className="px-3 py-2">{fmt(e.amount, e.currency)}</td>
              <td className="px-3 py-2">{bankLabel(e.bankSourceId)}</td>
              <td className="px-3 py-2">
                <ConfidencePill value={e.certainty} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {events.length === 0 && <p className="px-3 py-6 text-center text-xs text-ink-500">No payments currently due for this period.</p>}
    </div>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-50">{title}</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

async function postJson(url: string, body: unknown): Promise<string | null> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.error ?? "Save failed";
}

const fieldLabel = "flex flex-col gap-1 text-[11px] text-ink-500";

function CardStatementModal({
  cardRules,
  cardName,
  onClose,
  onSaved,
}: {
  cardRules: CardRule[];
  cardName: (ruleId: string) => string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({ cardRuleId: cardRules[0]?.id ?? "", closingDate: "", amount: "", minimumDue: "", amountPaid: "0", status: "Open" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const err = await postJson("/api/finance/credit/card-statements", {
      cardRuleId: f.cardRuleId,
      closingDate: f.closingDate,
      amount: Number(f.amount),
      minimumDue: f.minimumDue === "" ? null : Number(f.minimumDue),
      amountPaid: Number(f.amountPaid || 0),
      status: f.status,
    });
    setSaving(false);
    if (err) setError(err);
    else onSaved();
  }
  return (
    <ModalShell title="Enter Amex / card statement" onClose={onClose}>
      {cardRules.length === 0 ? (
        <p className="text-xs text-ink-500">Configure a card cycle first, then enter its statements.</p>
      ) : (
        <form onSubmit={submit} className="grid grid-cols-2 gap-2.5">
          <label className={`${fieldLabel} col-span-2`}>
            Card cycle
            <select value={f.cardRuleId} onChange={set("cardRuleId")} className={inputClass}>
              {cardRules.map((r) => (
                <option key={r.id} value={r.id}>
                  {cardName(r.id)} · closes day {r.statementDay}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldLabel}>
            Statement closing date
            <input type="date" required value={f.closingDate} onChange={set("closingDate")} className={inputClass} />
          </label>
          <label className={fieldLabel}>
            Statement balance
            <input type="number" step="0.01" required value={f.amount} onChange={set("amount")} className={inputClass} />
          </label>
          <label className={fieldLabel}>
            Minimum due (if shown)
            <input type="number" step="0.01" value={f.minimumDue} onChange={set("minimumDue")} className={inputClass} />
          </label>
          <label className={fieldLabel}>
            Amount already paid
            <input type="number" step="0.01" value={f.amountPaid} onChange={set("amountPaid")} className={inputClass} />
          </label>
          <label className={fieldLabel}>
            Status
            <select value={f.status} onChange={set("status")} className={inputClass}>
              {["Open", "Paid", "Disputed"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          {error && <p className="col-span-2 text-xs text-status-inactive">{error}</p>}
          <button
            type="submit"
            disabled={saving || !f.cardRuleId || !f.closingDate || f.amount === ""}
            className="col-span-2 rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save statement"}
          </button>
        </form>
      )}
    </ModalShell>
  );
}

function CardChargeModal({
  statements,
  cardName,
  onClose,
  onSaved,
}: {
  statements: CardStatement[];
  cardName: (ruleId: string) => string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({ statementId: statements[0]?.id ?? "", merchant: "", amount: "", currency: "USD", reference: "" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const err = await postJson("/api/finance/credit/card-charges", { ...f, amount: Number(f.amount) });
    setSaving(false);
    if (err) setError(err);
    else onSaved();
  }
  return (
    <ModalShell title="Record missing card charge" onClose={onClose}>
      {statements.length === 0 ? (
        <p className="text-xs text-ink-500">Enter the card statement first; charges are recorded against a statement.</p>
      ) : (
        <form onSubmit={submit} className="grid grid-cols-2 gap-2.5">
          <label className={`${fieldLabel} col-span-2`}>
            Statement
            <select value={f.statementId} onChange={set("statementId")} className={inputClass}>
              {statements.map((s) => (
                <option key={s.id} value={s.id}>
                  {cardName(s.cardRuleId)} · closes {fmtDate(s.closingDate)}
                </option>
              ))}
            </select>
          </label>
          <label className={`${fieldLabel} col-span-2`}>
            Merchant
            <input required value={f.merchant} onChange={set("merchant")} className={inputClass} />
          </label>
          <label className={fieldLabel}>
            Amount
            <input type="number" step="0.01" required value={f.amount} onChange={set("amount")} className={inputClass} />
          </label>
          <label className={fieldLabel}>
            Currency
            <input maxLength={3} value={f.currency} onChange={set("currency")} className={inputClass} />
          </label>
          <label className={`${fieldLabel} col-span-2`}>
            Reference
            <input value={f.reference} onChange={set("reference")} className={inputClass} />
          </label>
          {error && <p className="col-span-2 text-xs text-status-inactive">{error}</p>}
          <button
            type="submit"
            disabled={saving || !f.statementId || !f.merchant.trim() || f.amount === ""}
            className="col-span-2 rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save card charge"}
          </button>
        </form>
      )}
    </ModalShell>
  );
}

function BankLinkModal({
  sources,
  initialSourceId,
  onClose,
  onSaved,
}: {
  sources: PaymentSource[];
  initialSourceId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const bankSources = sources.filter((s) => s.kind === "Bank account");
  const [f, setF] = useState({
    paymentSourceId: initialSourceId ?? bankSources[0]?.id ?? "",
    bankAccountId: "",
    openingBalance: "",
    openingAsOf: "",
  });
  const [treasuryBanks, setTreasuryBanks] = useState<{ id: string; label: string; currency: string | null }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    fetch("/api/finance/treasury/bank-accounts")
      .then((r) => (r.ok ? r.json() : { banks: [] }))
      .then((d) => setTreasuryBanks(d.banks ?? []))
      .catch(() => setTreasuryBanks([]));
  }, []);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const err = await postJson("/api/finance/credit/bank-links", {
      paymentSourceId: f.paymentSourceId,
      bankAccountId: f.bankAccountId || null,
      openingBalance: f.openingBalance === "" ? null : Number(f.openingBalance),
      openingAsOf: f.openingAsOf || null,
    });
    setSaving(false);
    if (err) setError(err);
    else onSaved();
  }
  return (
    <ModalShell title="Map bank balance" onClose={onClose}>
      {bankSources.length === 0 ? (
        <p className="text-xs text-ink-500">Register a bank-account payment source on Payment Traceability first.</p>
      ) : (
        <form onSubmit={submit} className="grid grid-cols-2 gap-2.5">
          <label className={`${fieldLabel} col-span-2`}>
            Paying bank account
            <select value={f.paymentSourceId} onChange={set("paymentSourceId")} className={inputClass}>
              {bankSources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.currency ?? "—"}
                </option>
              ))}
            </select>
          </label>
          <label className={`${fieldLabel} col-span-2`}>
            ERP-linked treasury bank (optional)
            <select value={f.bankAccountId} onChange={set("bankAccountId")} className={inputClass}>
              <option value="">Not linked, use manual opening balance</option>
              {treasuryBanks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label} · {b.currency ?? "—"}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldLabel}>
            Manual opening balance
            <input type="number" step="0.01" value={f.openingBalance} onChange={set("openingBalance")} className={inputClass} />
          </label>
          <label className={fieldLabel}>
            Balance as of
            <input type="date" value={f.openingAsOf} onChange={set("openingAsOf")} className={inputClass} />
          </label>
          {error && <p className="col-span-2 text-xs text-status-inactive">{error}</p>}
          <button
            type="submit"
            disabled={saving || !f.paymentSourceId}
            className="col-span-2 rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save bank mapping"}
          </button>
        </form>
      )}
    </ModalShell>
  );
}
