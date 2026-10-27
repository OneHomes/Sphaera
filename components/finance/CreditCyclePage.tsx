"use client";

import { useMemo, useState } from "react";
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
  canAccessFinancePayroll,
}: {
  invoices: InvoiceRow[];
  recurring: RecurringRow[];
  forecast: ProjectionResult;
  cardRules: CardRule[];
  cardCharges: CardCharge[];
  canAccessFinancePayroll: boolean;
}) {
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <WidgetCard title="Scheduled cash outflows" icon={CreditCard}>
          <p className="mb-2 text-[11px] text-ink-500">Selected projection window, separated by currency</p>
          {currencyEntries.length > 0 ? (
            <div className="grid grid-cols-1 gap-2">
              {currencyEntries.map(([currency, amount]) => (
                <Tile key={currency} label={currency} value={fmt(amount, currency)} />
              ))}
            </div>
          ) : (
            <Tile label="Total" value="0" />
          )}
        </WidgetCard>
        <WidgetCard title="Unpaid invoices" icon={Receipt}>
          <Tile label={`${overdueInvoiceCount} overdue`} value={unpaidInvoices.length.toLocaleString()} />
        </WidgetCard>
        <WidgetCard title="Recurring obligations" icon={Repeat}>
          <Tile label="Employee salaries, rent, utilities and other rules" value={activeRecurringCount.toLocaleString()} />
        </WidgetCard>
        <WidgetCard title="Configured card cycles" icon={CreditCard}>
          <Tile label="Statement cutoff, payment due and settlement account" value={cardRules.length.toLocaleString()} />
        </WidgetCard>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap rounded-lg border border-base-700 bg-base-900 p-0.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                tab === t.value ? "bg-base-800 text-ink-50" : "text-ink-500 hover:text-ink-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-ink-500">
            Forecast from
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs text-ink-50 outline-none"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] text-ink-500">
            Forecast horizon
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs text-ink-50 outline-none"
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
            {forecast.overdue.length > 0 && (
              <div className="rounded-lg border border-status-inactive/40 bg-status-inactive/10 p-3 text-[11px] text-status-inactive">
                <p className="mb-1 flex items-center gap-1 font-medium">
                  <AlertTriangle className="h-3 w-3" strokeWidth={1.75} /> {forecast.overdue.length} overdue commitment(s)
                </p>
                <ul className="max-h-28 space-y-0.5 overflow-y-auto">
                  {forecast.overdue.slice(0, 10).map((e, i) => (
                    <li key={i}>
                      {fmtDate(e.date)} · {e.label} · {fmt(e.amount, e.currency)}
                    </li>
                  ))}
                </ul>
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
              {monthGroups.length === 0 && (
                <p className="text-xs text-ink-500">No scheduled outflows in this window.</p>
              )}
            </div>

            <WidgetCard title="CEO cash-cycle observations" icon={AlertTriangle}>
              <ul className="space-y-1.5 text-xs text-ink-300">
                {forecast.overdue.length > 0 && (
                  <li>• {forecast.overdue.length} commitment(s) are already overdue and unresolved.</li>
                )}
                {forecast.unassignedCount > 0 && (
                  <li>• {forecast.unassignedCount} commitment(s) have no paying bank assigned yet.</li>
                )}
                {needsStatementCycles.length > 0 && (
                  <li>• {needsStatementCycles.length} card cycle(s) need an actual statement before their amount is reliable.</li>
                )}
                {negativeAccounts.length > 0 && (
                  <li>• {negativeAccounts.length} bank account(s) are projected to go negative in this window.</li>
                )}
                {forecast.overdue.length === 0 &&
                  forecast.unassignedCount === 0 &&
                  needsStatementCycles.length === 0 &&
                  negativeAccounts.length === 0 && <li>No outstanding observations for the selected window.</li>}
              </ul>
            </WidgetCard>

            <WidgetCard title="Upcoming bills" icon={CalendarDays}>
              <div className="overflow-x-auto rounded-xl border border-base-700">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                    <tr>
                      <th className="px-3 py-2">Due date</th>
                      <th className="px-3 py-2">Commitment</th>
                      <th className="px-3 py-2">Reference</th>
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
                          No upcoming bills in this window.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </WidgetCard>
          </div>
        )}

        {tab === "invoices" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setEditingInvoice(null);
                  setShowInvoiceModal(true);
                }}
                className="flex items-center gap-1 rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.75} /> New invoice
              </button>
            </div>

            <WidgetCard title="Invoice cash events" icon={CalendarDays}>
              <div className="overflow-x-auto rounded-xl border border-base-700">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                    <tr>
                      <th className="px-3 py-2">Due date</th>
                      <th className="px-3 py-2">Invoice</th>
                      <th className="px-3 py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.events
                      .filter((e) => e.kind === "Invoice")
                      .map((e, i) => (
                        <tr key={i} className="border-b border-base-800 text-ink-300 last:border-0">
                          <td className="px-3 py-2 text-ink-50">{fmtDate(e.date)}</td>
                          <td className="px-3 py-2">{e.label}</td>
                          <td className="px-3 py-2">{fmt(e.amount, e.currency)}</td>
                        </tr>
                      ))}
                    {forecast.events.filter((e) => e.kind === "Invoice").length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-ink-500">
                          No unpaid or scheduled invoices fall in this window.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </WidgetCard>

            <WidgetCard title="Manage invoices" icon={Receipt}>
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
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="border-b border-base-800 text-ink-300 last:border-0">
                        <td className="px-3 py-2 text-ink-50">
                          {inv.vendor}
                          {inv.invoiceNumber && <span className="text-ink-500"> · {inv.invoiceNumber}</span>}
                        </td>
                        <td className="px-3 py-2">{fmtDate(inv.dueDate)}</td>
                        <td className="px-3 py-2">{fmt(inv.amount, inv.currency)}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={inv.status} />
                        </td>
                        <td className="px-3 py-2">
                          {inv.documentId ? (
                            <a href={`/api/documents/${inv.documentId}/download`} className="text-ink-300 hover:text-ink-50">
                              View evidence
                            </a>
                          ) : (
                            <span className="text-ink-500">No evidence attached</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingInvoice(inv);
                                setShowInvoiceModal(true);
                              }}
                              className="text-ink-500 hover:text-ink-300"
                              title="Review / edit"
                            >
                              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                            <button onClick={() => handleDeleteInvoice(inv.id)} className="text-ink-500 hover:text-status-inactive">
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {invoices.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-ink-500">
                          No AP invoices yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </WidgetCard>
          </div>
        )}

        {tab === "payroll" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setEditingRecurring(null);
                  setShowRecurringModal(true);
                }}
                className="flex items-center gap-1 rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.75} /> Add recurring payment
              </button>
            </div>
            <p className="text-[11px] text-ink-500">
              Example rules: &quot;day_of_month&quot; pays on a fixed day each month, &quot;nth_weekday&quot; pays on
              the Nth weekday (e.g. 2nd Friday), &quot;month_end&quot; pays on the last calendar day.
            </p>
            <WidgetCard title="Payroll and recurring obligations" icon={Repeat}>
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
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recurring.map((r) => (
                      <tr key={r.id} className="border-b border-base-800 text-ink-300 last:border-0">
                        <td className="px-3 py-2 text-ink-50">
                          {r.title}
                          <span className="ml-1.5 rounded-full bg-status-alert/15 px-2 py-0.5 text-[10px] font-medium text-status-alert">
                            {r.category}
                          </span>
                        </td>
                        <td className="px-3 py-2">{r.beneficiary ?? "—"}</td>
                        <td className="px-3 py-2">{r.country ?? "—"}</td>
                        <td className="px-3 py-2">{humanizeRecurrence(r)}</td>
                        <td className="px-3 py-2">{fmt(r.amount, r.currency)}</td>
                        <td className="px-3 py-2">{bankLabel(r.paymentSourceId)}</td>
                        <td className="px-3 py-2">
                          <ActivePill active={r.active} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingRecurring(r);
                                setShowRecurringModal(true);
                              }}
                              className="text-ink-500 hover:text-ink-300"
                              disabled={r.category === "Salary" && !canAccessFinancePayroll}
                            >
                              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                            <button
                              onClick={() => handleDeleteRecurring(r.id)}
                              disabled={r.category === "Salary" && !canAccessFinancePayroll}
                              className="text-ink-500 hover:text-status-inactive disabled:opacity-40"
                            >
                              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {recurring.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center text-ink-500">
                          No recurring obligations yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </WidgetCard>
          </div>
        )}

        {tab === "cards" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-status-alert/40 bg-status-alert/10 p-3 text-[11px] text-status-alert">
              Statement minimums shown here require the actual statement to be entered — an estimate from the
              minimum-due rule is not the same as the real charges on the card. Confirm against the Amex / card
              portal before relying on a projected amount.
            </div>

            <WidgetCard
              title="Registered card billing rules"
              icon={CreditCard}
              action={
                <button
                  onClick={() => {
                    setEditingCardRule(null);
                    setShowCardRuleModal(true);
                  }}
                  className="flex items-center gap-1 rounded-lg border border-base-700 px-2.5 py-1.5 text-[11px] font-medium text-ink-300 hover:bg-base-800"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.75} /> Add rule
                </button>
              }
            >
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
                        <td className="px-3 py-2 text-ink-50">Card cycle {rule.id.slice(0, 8)}</td>
                        <td className="px-3 py-2">Day {rule.statementDay}</td>
                        <td className="px-3 py-2">{rule.dueOffsetDays} days</td>
                        <td className="px-3 py-2">{rule.settlement}</td>
                        <td className="px-3 py-2">{bankLabel(rule.paymentAccountId)}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => {
                              setEditingCardRule(rule);
                              setShowCardRuleModal(true);
                            }}
                            className="text-ink-500 hover:text-ink-300"
                          >
                            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {cardRules.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-ink-500">
                          No card cycles configured yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </WidgetCard>

            <WidgetCard title="Statement cycles and projected settlement dates" icon={CalendarDays}>
              <div className="overflow-x-auto rounded-xl border border-base-700">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                    <tr>
                      <th className="px-3 py-2">Card</th>
                      <th className="px-3 py-2">Period</th>
                      <th className="px-3 py-2">Closes</th>
                      <th className="px-3 py-2">Due</th>
                      <th className="px-3 py-2">Charges recorded</th>
                      <th className="px-3 py-2">Amount payable</th>
                      <th className="px-3 py-2">Rollover</th>
                      <th className="px-3 py-2">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.cycles.map((c, i) => (
                      <tr key={i} className="border-b border-base-800 text-ink-300 last:border-0">
                        <td className="px-3 py-2 text-ink-50">Card cycle {c.cardRuleId.slice(0, 8)}</td>
                        <td className="px-3 py-2">
                          {fmtDate(c.periodStart)} – {fmtDate(c.closingDate)}
                        </td>
                        <td className="px-3 py-2">{fmtDate(c.closingDate)}</td>
                        <td className="px-3 py-2">{fmtDate(c.dueDate)}</td>
                        <td className="px-3 py-2">{fmt(c.chargeTotal, c.currency)}</td>
                        <td className="px-3 py-2">{c.amountDue !== null ? fmt(c.amountDue, c.currency) : "Not yet known"}</td>
                        <td className="px-3 py-2">{fmt(c.estimatedCarryForward, c.currency)}</td>
                        <td className="px-3 py-2">
                          <ConfidencePill value={c.accuracy} />
                        </td>
                      </tr>
                    ))}
                    {forecast.cycles.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center text-ink-500">
                          No card settlement cycles in this window.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </WidgetCard>

            <WidgetCard title="Manual card charges" icon={Receipt}>
              <div className="overflow-x-auto rounded-xl border border-base-700">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                    <tr>
                      <th className="px-3 py-2">Merchant</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Reference</th>
                      <th className="px-3 py-2">Statement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cardCharges.map((c) => (
                      <tr key={c.id} className="border-b border-base-800 text-ink-300 last:border-0">
                        <td className="px-3 py-2 text-ink-50">{c.merchant}</td>
                        <td className="px-3 py-2">{fmt(c.amount, c.currency)}</td>
                        <td className="px-3 py-2">{c.reference ?? "—"}</td>
                        <td className="px-3 py-2">{c.statementId.slice(0, 8)}</td>
                      </tr>
                    ))}
                    {cardCharges.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-ink-500">
                          No manual card charges recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </WidgetCard>
          </div>
        )}

        {tab === "bank" && (
          <div className="space-y-4">
            <div className="rounded-lg border border-status-alert/40 bg-status-alert/10 p-3 text-[11px] text-status-alert">
              Bank balances shown here are ERP-reported or manually entered snapshots, not a live bank feed. Confirm
              against the actual bank statement before treating a projected balance as verified cash.
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {forecast.accounts.map((a) => (
                <WidgetCard key={a.sourceId} title={a.account} icon={Landmark}>
                  <div className="space-y-2">
                    <Tile
                      label="Projected balance"
                      value={a.forecastBalance !== null ? fmt(a.forecastBalance, a.currency) : "Unknown"}
                    />
                    <Tile label="Opening balance" value={a.balance !== null ? fmt(a.balance, a.currency) : "Unknown"} />
                    <Tile label="Known debits in window" value={fmt(a.knownOutflows, a.currency)} />
                  </div>
                  <p className="mt-2 text-[11px] text-ink-500">
                    {a.source} {a.asOf ? `· as of ${fmtDate(a.asOf)}` : ""}
                  </p>
                </WidgetCard>
              ))}
              {forecast.accounts.length === 0 && <p className="text-xs text-ink-500">No bank accounts registered yet.</p>}
            </div>

            <WidgetCard title="Bank account mapping" icon={Landmark}>
              <div className="overflow-x-auto rounded-xl border border-base-700">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                    <tr>
                      <th className="px-3 py-2">Account</th>
                      <th className="px-3 py-2">Currency</th>
                      <th className="px-3 py-2">Source</th>
                      <th className="px-3 py-2">As of</th>
                      <th className="px-3 py-2">Treasury account linked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.accounts.map((a) => (
                      <tr key={a.sourceId} className="border-b border-base-800 text-ink-300 last:border-0">
                        <td className="px-3 py-2 text-ink-50">{a.account}</td>
                        <td className="px-3 py-2">{a.currency}</td>
                        <td className="px-3 py-2">{a.source}</td>
                        <td className="px-3 py-2">{fmtDate(a.asOf)}</td>
                        <td className="px-3 py-2">{a.bankAccountId ? "Linked" : "Not linked"}</td>
                      </tr>
                    ))}
                    {forecast.accounts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-ink-500">
                          No bank accounts registered yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-ink-500">
                Link treasury bank accounts to a payment source from the Banks screen to complete ERP-reported
                balance matching.
              </p>
            </WidgetCard>
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
