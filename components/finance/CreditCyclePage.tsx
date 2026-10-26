"use client";

import { useMemo, useState } from "react";
import { CreditCard, Receipt, Repeat, X, Plus, Trash2, AlertTriangle, Clock } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

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
  status: string;
  reference: string | null;
  notes: string | null;
};

type RecurringRow = {
  id: string;
  title: string;
  category: string;
  beneficiary: string | null;
  currency: string;
  amount: number;
  recurrenceRule: string;
  startDate: string | Date | null;
  endDate: string | Date | null;
  active: boolean;
};

type CashEvent = {
  date: string;
  kind: string;
  label: string;
  amount: number;
  currency: string;
  certainty: string;
  reference: string;
};

type ProjectionResult = {
  from: string;
  to: string;
  totalsByCurrency: Record<string, number>;
  events: CashEvent[];
  overdue: CashEvent[];
  unassignedCount: number;
  unassignedByCurrency: Record<string, number>;
  limitations: string[];
};

const INVOICE_STATUSES = ["Unpaid", "Scheduled", "Paid", "Cancelled"];
const RECURRING_CATEGORIES = ["Salary", "Rent", "Tax", "Loan", "Utility", "Subscription", "Other"];
const RECURRENCE_RULES = ["month_end", "last_business_day", "month_start", "day_of_month", "nth_weekday", "last_weekday", "weekly"];

function formatUsd(value: number, currency = "USD"): string {
  return `${currency} ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
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

function StatusBadge({ status }: { status: string }) {
  const style =
    status === "Paid"
      ? "bg-status-active/15 text-status-active"
      : status === "Cancelled"
        ? "bg-status-inactive/15 text-status-inactive"
        : "bg-status-alert/15 text-status-alert";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${style}`}>{status}</span>;
}

const inputClass =
  "w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500";

export function CreditCyclePage({
  invoices: initialInvoices,
  recurring: initialRecurring,
  forecast,
  canAccessFinancePayroll,
}: {
  invoices: InvoiceRow[];
  recurring: RecurringRow[];
  forecast: ProjectionResult;
  canAccessFinancePayroll: boolean;
}) {
  const [invoices, setInvoices] = useState<InvoiceRow[]>(initialInvoices);
  const [recurring, setRecurring] = useState<RecurringRow[]>(initialRecurring);
  const [tab, setTab] = useState<"invoices" | "recurring">("invoices");
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);

  async function reloadInvoices() {
    const res = await fetch("/api/finance/credit/invoices");
    if (res.ok) {
      const data = await res.json();
      setInvoices(data.invoices ?? []);
    }
  }
  async function reloadRecurring() {
    const res = await fetch("/api/finance/credit/recurring");
    if (res.ok) {
      const data = await res.json();
      setRecurring(data.recurring ?? []);
    }
  }

  async function handleDeleteInvoice(id: string) {
    if (!confirm("Delete this invoice?")) return;
    const res = await fetch(`/api/finance/credit/invoices/${id}`, { method: "DELETE" });
    if (res.ok) setInvoices((prev) => prev.filter((i) => i.id !== id));
    else {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Failed to delete invoice");
    }
  }

  async function handleDeleteRecurring(id: string) {
    if (!confirm("Delete this recurring bill?")) return;
    const res = await fetch(`/api/finance/credit/recurring/${id}`, { method: "DELETE" });
    if (res.ok) setRecurring((prev) => prev.filter((r) => r.id !== id));
    else {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "Failed to delete recurring bill");
    }
  }

  const timeline = useMemo(() => {
    const buckets = new Map<string, Map<string, { amount: number; count: number }>>();
    for (const e of forecast.events) {
      const month = e.date.slice(0, 7);
      if (!buckets.has(month)) buckets.set(month, new Map());
      const byCurrency = buckets.get(month)!;
      const cur = byCurrency.get(e.currency) ?? { amount: 0, count: 0 };
      cur.amount += e.amount;
      cur.count += 1;
      byCurrency.set(e.currency, cur);
    }
    return Array.from(buckets.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .flatMap(([month, byCurrency]) =>
        Array.from(byCurrency.entries()).map(([currency, v]) => ({ month, currency, ...v }))
      );
  }, [forecast.events]);

  const currencyEntries = Object.entries(forecast.totalsByCurrency);

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Credit Cycle</h1>
          <p className="mt-1 text-sm text-ink-500">
            Forward cash outflows from {forecast.from} to {forecast.to}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <WidgetCard title="Known Outflows" icon={CreditCard}>
          {currencyEntries.length > 0 ? (
            <div className="grid grid-cols-1 gap-2">
              {currencyEntries.map(([currency, amount]) => (
                <Tile key={currency} label={currency} value={formatUsd(amount, currency)} />
              ))}
            </div>
          ) : (
            <Tile label="Total" value="0" />
          )}
        </WidgetCard>
        <WidgetCard title="Overdue" icon={AlertTriangle}>
          <Tile label="Past due, not yet settled" value={forecast.overdue.length.toLocaleString()} />
        </WidgetCard>
        <WidgetCard title="Unassigned to a Bank" icon={Clock}>
          <Tile label="No payment source linked" value={forecast.unassignedCount.toLocaleString()} />
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard title="Forward Cash-Outflow Timeline" icon={CreditCard}>
          {forecast.overdue.length > 0 && (
            <div className="mb-3 rounded-lg border border-status-inactive/40 bg-status-inactive/10 p-2.5 text-[11px] text-status-inactive">
              <p className="mb-1 flex items-center gap-1 font-medium">
                <AlertTriangle className="h-3 w-3" strokeWidth={1.75} /> {forecast.overdue.length} overdue commitment(s)
              </p>
              <ul className="max-h-24 space-y-0.5 overflow-y-auto">
                {forecast.overdue.slice(0, 10).map((e, i) => (
                  <li key={i}>
                    {formatDate(e.date)} · {e.label} · {formatUsd(e.amount, e.currency)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Period</th>
                  <th className="px-3 py-2">Currency</th>
                  <th className="px-3 py-2">Outflow</th>
                  <th className="px-3 py-2">Events</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((row) => (
                  <tr key={`${row.month}-${row.currency}`} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="px-3 py-2 text-ink-50">{row.month}</td>
                    <td className="px-3 py-2">{row.currency}</td>
                    <td className="px-3 py-2">{formatUsd(row.amount, row.currency)}</td>
                    <td className="px-3 py-2">{row.count}</td>
                  </tr>
                ))}
                {timeline.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-ink-500">
                      No upcoming outflows in this window.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <ul className="mt-3 space-y-0.5 text-[10px] text-ink-600">
            {forecast.limitations.map((l, i) => (
              <li key={i}>• {l}</li>
            ))}
          </ul>
        </WidgetCard>
      </div>

      <div className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="inline-flex rounded-lg border border-base-700 bg-base-900 p-0.5">
            {(["invoices", "recurring"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setTab(v)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  tab === v ? "bg-base-800 text-ink-50" : "text-ink-500 hover:text-ink-300"
                }`}
              >
                {v === "invoices" ? "AP Invoices" : "Recurring Bills"}
              </button>
            ))}
          </div>
          <button
            onClick={() => (tab === "invoices" ? setShowInvoiceModal(true) : setShowRecurringModal(true))}
            className="flex items-center gap-1 rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            {tab === "invoices" ? "Add Invoice" : "Add Recurring Bill"}
          </button>
        </div>

        {tab === "invoices" ? (
          <WidgetCard title="AP Invoices" icon={Receipt}>
            <div className="overflow-x-auto rounded-xl border border-base-700">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                  <tr>
                    <th className="px-3 py-2">Vendor</th>
                    <th className="px-3 py-2">Invoice #</th>
                    <th className="px-3 py-2">Due Date</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Department</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-base-800 text-ink-300 last:border-0">
                      <td className="px-3 py-2 text-ink-50">{inv.vendor}</td>
                      <td className="px-3 py-2">{inv.invoiceNumber ?? "—"}</td>
                      <td className="px-3 py-2">{formatDate(inv.dueDate)}</td>
                      <td className="px-3 py-2">{formatUsd(inv.amount, inv.currency)}</td>
                      <td className="px-3 py-2">{inv.department ?? "—"}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => handleDeleteInvoice(inv.id)} className="text-ink-500 hover:text-status-inactive">
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {invoices.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-ink-500">
                        No AP invoices yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </WidgetCard>
        ) : (
          <WidgetCard title="Recurring Bills" icon={Repeat}>
            <div className="overflow-x-auto rounded-xl border border-base-700">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                  <tr>
                    <th className="px-3 py-2">Title</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Beneficiary</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Rule</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {recurring.map((r) => (
                    <tr key={r.id} className="border-b border-base-800 text-ink-300 last:border-0">
                      <td className="px-3 py-2 text-ink-50">{r.title}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-status-alert/15 px-2 py-0.5 text-[11px] font-medium text-status-alert">
                          {r.category}
                        </span>
                      </td>
                      <td className="px-3 py-2">{r.beneficiary ?? "—"}</td>
                      <td className="px-3 py-2">{formatUsd(r.amount, r.currency)}</td>
                      <td className="px-3 py-2">{r.recurrenceRule.replace(/_/g, " ")}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            r.active ? "bg-status-active/15 text-status-active" : "bg-status-inactive/15 text-status-inactive"
                          }`}
                        >
                          {r.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={() => handleDeleteRecurring(r.id)} className="text-ink-500 hover:text-status-inactive">
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {recurring.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-ink-500">
                        No recurring bills yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </WidgetCard>
        )}
      </div>

      {showInvoiceModal && (
        <AddInvoiceModal
          onClose={() => setShowInvoiceModal(false)}
          onCreated={() => {
            setShowInvoiceModal(false);
            reloadInvoices();
          }}
        />
      )}
      {showRecurringModal && (
        <AddRecurringModal
          canAccessFinancePayroll={canAccessFinancePayroll}
          onClose={() => setShowRecurringModal(false)}
          onCreated={() => {
            setShowRecurringModal(false);
            reloadRecurring();
          }}
        />
      )}
    </div>
  );
}

function AddInvoiceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [vendor, setVendor] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [department, setDepartment] = useState("");
  const [status, setStatus] = useState("Unpaid");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/credit/invoices", {
        method: "POST",
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
      if (!res.ok) throw new Error(data?.error ?? "Failed to create invoice");
      onCreated();
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
          <h2 className="text-sm font-medium text-ink-50">New AP Invoice</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Supplier / vendor" className={inputClass} />
          <div className="flex gap-2">
            <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Invoice number (optional)" className={inputClass} />
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
            {isSaving ? "Creating…" : "Create invoice"}
          </button>
        </form>
      </div>
    </div>
  );
}

function AddRecurringModal({
  canAccessFinancePayroll,
  onClose,
  onCreated,
}: {
  canAccessFinancePayroll: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Rent");
  const [beneficiary, setBeneficiary] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [recurrenceRule, setRecurrenceRule] = useState("month_end");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [startDate, setStartDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/credit/recurring", {
        method: "POST",
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
          active: true,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to create recurring bill");
      onCreated();
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
          <h2 className="text-sm font-medium text-ink-50">New Recurring Bill</h2>
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
          {error && <p className="text-xs text-status-inactive">{error}</p>}
          <button
            type="submit"
            disabled={isSaving || !title.trim() || !amount || !startDate || (category === "Salary" && !canAccessFinancePayroll)}
            className="w-full rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
          >
            {isSaving ? "Creating…" : "Create recurring bill"}
          </button>
        </form>
      </div>
    </div>
  );
}
