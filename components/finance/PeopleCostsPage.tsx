"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { useFinanceFilters } from "./FinanceFilterContext";
import { fyOf } from "@/lib/finance/financeFilters";
import { effectiveCentre } from "@/lib/finance/financeReporting";
import type { FinanceLedgerRow } from "@/lib/finance/ledgerData";

// Port of the source app's People Costs screen at v41: employee roster Excel import, suggested
// name/alias payment matches, the cost-per-person report, the employee register (job title,
// email, payment alias), cross-year payment search with multi-select batch allocation to one
// employee, the single-payment split editor and the allocation history. Allocations attribute
// existing ledger payments; they are never additional expenses.

const COST_TYPES = ["Salary", "Commission", "Bonus", "Employer taxes", "Benefits", "Other personnel"] as const;

type Person = {
  id: string;
  fullName: string;
  department: string | null;
  jobTitle: string;
  email: string;
  paymentAlias: string;
  active: boolean;
};

type Allocation = {
  id: string;
  transactionId: string;
  personId: string;
  costType: string;
  amountUsd: number;
  departmentSnapshot: string | null;
  jobTitleSnapshot: string;
  reference: string | null;
  note: string | null;
  updatedAt: string | Date;
  paymentDescription: string;
  month: string;
  paymentDate: string | Date | null;
  paymentAmount: number;
  personName: string;
};

type Suggestion = {
  transactionId: string;
  personId: string;
  personName: string;
  jobTitle: string;
  department: string | null;
  description: string;
  month: string;
  costType: string;
  amountUsd: number;
};

type PersonCostState = {
  people: Person[];
  allocations: Allocation[];
  costTypes: string[];
  suggestions: Suggestion[];
};

type ImportPreview = {
  file: File;
  rows: { row: number; status: string; full_name: string; department: string; job_title: string; email: string; errors: string[] }[];
  valid: number;
  errors: number;
};

type AllocationLineDraft = { key: string; personId: string; costType: string; amountUsd: string; reference: string; note: string };
type Pick = { costType: string; amountUsd: string; reference: string };

// Source peMoney(): exact USD with cents.
const moneyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
function usd(value: number): string {
  return moneyFmt.format(Number(value) || 0);
}
const cents = (n: number | string) => Math.round(Number(n) * 100);

// Source peType() / peIsPersonnel().
function guessType(t: FinanceLedgerRow): string {
  const s = [effectiveCentre(t), t.head, t.description].join(" ").toLowerCase();
  if (/commission|comm\b|referral/.test(s)) return "Commission";
  if (/bonus|incentive/.test(s)) return "Bonus";
  if (/employer tax|payroll tax/.test(s)) return "Employer taxes";
  if (/benefit|pension/.test(s)) return "Benefits";
  return "Salary";
}
const isPersonnel = (t: FinanceLedgerRow) =>
  /salary|salaries|payroll|wages|commission|bonus|incentive|pension|benefit|personnel|staff|employer tax|reimburse/.test(
    [effectiveCentre(t), t.head, t.description].join(" ").toLowerCase()
  );

function Kpi({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <h4 className="text-[11px] text-ink-500">{title}</h4>
      <div className="mt-1 text-xl font-semibold text-ink-50">{value}</div>
      <div className="mt-1 text-[11px] text-ink-500">{detail}</div>
    </div>
  );
}

function newDraftLine(): AllocationLineDraft {
  return { key: Math.random().toString(36).slice(2), personId: "", costType: "Salary", amountUsd: "", reference: "", note: "" };
}

const inputClass = "w-full rounded-lg border border-base-700 bg-base-800 px-2.5 py-1.5 text-xs text-ink-50 outline-none placeholder:text-ink-500";
const labelClass = "flex flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-ink-500";
const smallBtn = "rounded-md border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50 disabled:opacity-40";
const primaryBtn = "rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:opacity-90 disabled:opacity-50";

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data;
}

export function PeopleCostsPage({
  state,
  departments,
  transactions,
}: {
  state: PersonCostState;
  departments: string[];
  transactions: FinanceLedgerRow[];
}) {
  const [data, setData] = useState<PersonCostState>(state);
  const { people, allocations } = data;
  const { filters } = useFinanceFilters();
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch("/api/finance/people");
    if (res.ok) setData(await res.json());
  }, []);

  const txById = useMemo(() => new Map(transactions.map((t) => [t.id, t])), [transactions]);
  const usedCents = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of allocations) m.set(a.transactionId, (m.get(a.transactionId) ?? 0) + cents(a.amountUsd));
    return m;
  }, [allocations]);
  const balance = useCallback((t: FinanceLedgerRow) => (cents(t.amount) - (usedCents.get(t.id) ?? 0)) / 100, [usedCents]);

  // --- Cost per person (respects the global reporting filters) ----------------------------------
  const [filterDept, setFilterDept] = useState<string>("all");
  const [filterPerson, setFilterPerson] = useState<string>("all");

  const scopedAllocations = useMemo(
    () =>
      allocations.filter(
        (a) =>
          (filters.fy === "all" || fyOf(a.month) === Number(filters.fy)) &&
          (filters.start === "all" || a.month >= filters.start) &&
          (filters.end === "all" || a.month <= filters.end) &&
          (filters.country === "all" || txById.get(a.transactionId)?.country === filters.country) &&
          (filters.department === "all" || a.departmentSnapshot === filters.department)
      ),
    [allocations, filters, txById]
  );
  const filteredAllocations = useMemo(
    () =>
      scopedAllocations.filter(
        (a) => (filterDept === "all" || (a.departmentSnapshot ?? "") === filterDept) && (filterPerson === "all" || a.personId === filterPerson)
      ),
    [scopedAllocations, filterDept, filterPerson]
  );

  const sumBy = (pred: (a: Allocation) => boolean) => filteredAllocations.filter(pred).reduce((s, a) => s + a.amountUsd, 0);
  const attributedSalary = sumBy((a) => a.costType === "Salary");
  const attributedCommission = sumBy((a) => a.costType === "Commission");
  const otherEmployerCosts = sumBy((a) => a.costType !== "Salary" && a.costType !== "Commission");

  const costPerPerson = useMemo(() => {
    const map = new Map<string, { personId: string; name: string; department: string | null; jobTitle: string; salary: number; commission: number; other: number; total: number }>();
    for (const a of filteredAllocations) {
      const e = map.get(a.personId) ?? { personId: a.personId, name: a.personName, department: a.departmentSnapshot, jobTitle: a.jobTitleSnapshot, salary: 0, commission: 0, other: 0, total: 0 };
      if (a.costType === "Salary") e.salary += a.amountUsd;
      else if (a.costType === "Commission") e.commission += a.amountUsd;
      else e.other += a.amountUsd;
      e.total += a.amountUsd;
      map.set(a.personId, e);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredAllocations]);

  // --- Excel roster import ----------------------------------------------------------------------
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(label: string, fn: () => Promise<string | void>) {
    setBusy(label);
    setNotice(null);
    try {
      const text = await fn();
      if (text) setNotice({ kind: "ok", text });
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setBusy(null);
    }
  }

  const previewExcel = (file: File) =>
    run("preview", async () => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/finance/people/preview", { method: "POST", body: fd });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Preview failed");
      setPreview({ file, ...body });
    });

  const commitExcel = () =>
    run("commit", async () => {
      if (!preview || preview.errors) throw new Error("Fix Excel errors before import.");
      if (!window.confirm(`Import ${preview.rows.length} employee records? No payment amounts will be changed.`)) return;
      const fd = new FormData();
      fd.append("file", preview.file);
      const res = await fetch("/api/finance/people/commit", { method: "POST", body: fd });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? "Import failed");
      setPreview(null);
      await reload();
      return `People directory: ${body.added} added, ${body.updated} updated. Review suggested payment matches below.`;
    });

  // --- Suggested matches ------------------------------------------------------------------------
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const suggestions = data.suggestions ?? [];
  const linkMatches = () =>
    run("link", async () => {
      const ids = [...selectedMatches];
      if (!ids.length) throw new Error("Select proposed matches first.");
      const total = suggestions.filter((s) => selectedMatches.has(s.transactionId)).reduce((n, s) => n + s.amountUsd, 0);
      if (!window.confirm(`Assign ${ids.length} existing payments to the suggested employees? Total: ${usd(total)}\n\nReview the individual employee names first.`)) return;
      const body = await postJson("/api/finance/people/link-suggestions", { transactionIds: ids });
      setSelectedMatches(new Set());
      await reload();
      return `${body.linked} payments linked; ${usd(body.totalUsd)} attributed. Original ledger unchanged.`;
    });

  // --- Register employee ------------------------------------------------------------------------
  const blankPerson = { name: "", jobTitle: "", email: "", paymentAlias: "", department: departments[0] ?? "", active: true };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blankPerson);
  const [personError, setPersonError] = useState<string | null>(null);

  function startEdit(p: Person) {
    setEditingId(p.id);
    setForm({ name: p.fullName, jobTitle: p.jobTitle, email: p.email, paymentAlias: p.paymentAlias, department: p.department ?? departments[0] ?? "", active: p.active });
    setPersonError(null);
  }
  function resetPersonForm() {
    setEditingId(null);
    setForm(blankPerson);
    setPersonError(null);
  }
  async function submitPerson(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy("person");
    setPersonError(null);
    try {
      await postJson("/api/finance/people", { id: editingId ?? undefined, ...form });
      resetPersonForm();
      await reload();
    } catch (err) {
      setPersonError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  // --- Find payments + batch allocation (v41) ---------------------------------------------------
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [onlyUnassigned, setOnlyUnassigned] = useState(true);
  const [scope, setScope] = useState<"personnel" | "all">("personnel");
  const [picks, setPicks] = useState<Record<string, Pick>>({});

  // Source pePaymentChoices(): every year, independent of the dashboard filters.
  const choices = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return transactions
      .filter((t) => {
        if (!(Number(t.amount) > 0)) return false;
        if (!terms.length && scope === "personnel" && !isPersonnel(t)) return false;
        const hay = [t.id, t.description, t.head, t.costCentre, t.month, t.date ? String(t.date).slice(0, 10) : "", t.paymentReference, t.erpPaymentId, t.invoiceReference, t.traceSupplier, t.tracePurpose, t.country, Number(t.amount).toFixed(2)]
          .join(" ")
          .toLowerCase();
        if (!terms.every((term) => hay.includes(term))) return false;
        return !onlyUnassigned || balance(t) > 0.009;
      })
      .sort((a, b) => String(b.date ?? b.month).localeCompare(String(a.date ?? a.month)) || String(b.id).localeCompare(String(a.id)));
  }, [transactions, query, scope, onlyUnassigned, balance]);
  const displayed = choices.slice(0, 80);
  const pickEntries = Object.entries(picks);
  const pickTotal = pickEntries.reduce((n, [, p]) => n + (Number(p.amountUsd) || 0), 0);

  function addPick(t: FinanceLedgerRow, into: Record<string, Pick>) {
    if (balance(t) <= 0 || into[t.id]) return;
    into[t.id] = { costType: guessType(t), amountUsd: balance(t).toFixed(2), reference: "" };
  }
  function togglePick(t: FinanceLedgerRow, on: boolean) {
    setPicks((prev) => {
      const next = { ...prev };
      if (on) addPick(t, next);
      else delete next[t.id];
      return next;
    });
  }
  function chooseEmployee(id: string) {
    setSelectedEmployee(id);
    setPicks({});
  }

  const saveBatch = () =>
    run("batch", async () => {
      if (!selectedEmployee || !pickEntries.length) throw new Error("Select an employee and at least one payment.");
      for (const [id, p] of pickEntries) {
        const t = txById.get(id);
        if (!t || !(Number(p.amountUsd) > 0) || cents(p.amountUsd) > cents(balance(t))) throw new Error("A selected payment amount exceeds its unallocated balance.");
      }
      const employee = people.find((p) => p.id === selectedEmployee)?.fullName ?? "employee";
      if (!window.confirm(`Allocate ${pickEntries.length} payments totalling ${usd(pickTotal)} to ${employee}? Categories and amounts will be logged as a single undoable action.`)) return;
      const body = await postJson("/api/finance/people/allocate-batch", {
        personId: selectedEmployee,
        items: pickEntries.map(([transactionId, p]) => ({ transactionId, ...p })),
      });
      setPicks({});
      await reload();
      return `Allocated ${body.payments} payments (${usd(body.allocatedUsd)}).`;
    });

  // --- Single-payment split editor --------------------------------------------------------------
  const [editPaymentId, setEditPaymentId] = useState<string | null>(null);
  const [draftLines, setDraftLines] = useState<AllocationLineDraft[]>([]);
  const [allocError, setAllocError] = useState<string | null>(null);
  const editPayment = editPaymentId ? txById.get(editPaymentId) ?? null : null;
  const hasExisting = editPaymentId ? allocations.some((a) => a.transactionId === editPaymentId) : false;

  function openPayment(id: string) {
    setEditPaymentId(id);
    setAllocError(null);
    const existing = allocations.filter((a) => a.transactionId === id);
    setDraftLines(
      existing.length
        ? existing.map((a) => ({ key: a.id, personId: a.personId, costType: a.costType, amountUsd: a.amountUsd.toFixed(2), reference: a.reference ?? "", note: a.note ?? "" }))
        : [newDraftLine()]
    );
  }
  const updateLine = (key: string, patch: Partial<AllocationLineDraft>) => setDraftLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const draftTotal = draftLines.reduce((s, l) => s + (parseFloat(l.amountUsd) || 0), 0);

  async function saveAllocation(clear = false) {
    if (!editPaymentId || busy) return;
    const lines = (clear ? [] : draftLines)
      .filter((l) => l.personId && l.amountUsd)
      .map(({ personId, costType, amountUsd, reference, note }) => ({ personId, costType, amountUsd, reference, note }));
    if (!window.confirm(`Save ${lines.length} allocation line(s) against this original payment?`)) return;
    setBusy("alloc");
    setAllocError(null);
    try {
      const body = await postJson("/api/finance/people/payment", { transactionId: editPaymentId, lines });
      setEditPaymentId(null);
      setDraftLines([]);
      await reload();
      if (Math.abs(body.unallocatedUsd) > 0.009) setNotice({ kind: "ok", text: `${usd(body.unallocatedUsd)} of this payment remains unattributed.` });
    } catch (err) {
      setAllocError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  const history = useMemo(
    () => [...filteredAllocations].sort((a, b) => new Date(b.paymentDate ?? 0).getTime() - new Date(a.paymentDate ?? 0).getTime()).slice(0, 200),
    [filteredAllocations]
  );
  const selectedName = people.find((p) => p.id === selectedEmployee)?.fullName;

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-ink-50">People costs · salary and commissions</h2>
        <p className="mt-1 text-sm text-ink-500">
          Assign multiple payroll or commission payments to one employee, or split a payment between people. This attributes existing
          ledger costs without creating new expense transactions. Values shown in USD.
        </p>
      </div>

      {notice && (
        <div className={`mb-4 rounded-lg border px-3 py-2 text-xs ${notice.kind === "ok" ? "border-status-active/40 bg-status-active/10 text-status-active" : "border-status-inactive/40 bg-status-inactive/10 text-status-inactive"}`}>
          {notice.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Attributed salary" value={usd(attributedSalary)} detail="Within current financial filters" />
        <Kpi title="Attributed commission" value={usd(attributedCommission)} detail="Linked to individual employees" />
        <Kpi title="Other employer costs" value={usd(otherEmployerCosts)} detail="Bonuses, taxes and benefits" />
        <Kpi title="Total attributed people cost" value={usd(attributedSalary + attributedCommission + otherEmployerCosts)} detail="All assigned personnel payment lines" />
      </div>

      <div className="mt-4">
        <WidgetCard
          title="Import employees and departments from Excel"
          action={
            <a href="/api/finance/people/template" className={smallBtn}>
              Download Excel template
            </a>
          }
        >
          <p className="mb-3 text-xs text-ink-500">
            Upload the approved employee roster to populate names, departments, job titles, email addresses and matching aliases. Preview
            before importing; no bank payments are altered.
          </p>
          <label className={`${smallBtn} inline-block cursor-pointer`}>
            {busy === "preview" ? "Checking…" : "Preview staff upload (.xlsx)"}
            <input type="file" accept=".xlsx" className="hidden" disabled={!!busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) previewExcel(f); }} />
          </label>
          {preview && (
            <div className="mt-3">
              <p className={`mb-2 rounded-lg border px-3 py-2 text-xs ${preview.errors ? "border-status-alert/40 bg-status-alert/10 text-status-alert" : "border-base-700 bg-base-800 text-ink-300"}`}>
                <b>{preview.valid} valid rows</b> · {preview.errors} errors · {preview.rows.length} total employees.{" "}
                {preview.errors ? "Correct the workbook and upload again." : "Review the changes then confirm."}
              </p>
              <div className="max-h-[280px] overflow-auto rounded-xl border border-base-700">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 border-b border-base-700 bg-base-900 text-ink-500">
                    <tr>{["Row", "Status", "Name", "Department", "Job title", "Email", "Validation"].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 500).map((r) => (
                      <tr key={r.row} className="border-b border-base-800 text-ink-300 last:border-0">
                        <td className="px-3 py-1.5">{r.row}</td>
                        <td className={`px-3 py-1.5 ${r.status === "Error" ? "text-status-inactive" : ""}`}>{r.status}</td>
                        <td className="px-3 py-1.5 text-ink-50">{r.full_name}</td>
                        <td className="px-3 py-1.5">{r.department}</td>
                        <td className="px-3 py-1.5">{r.job_title}</td>
                        <td className="px-3 py-1.5">{r.email}</td>
                        <td className={`px-3 py-1.5 ${r.errors.length ? "text-status-inactive" : "text-status-active"}`}>{r.errors.join("; ") || "Ready"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex gap-2">
                {!preview.errors && (
                  <button onClick={commitExcel} disabled={!!busy} className={primaryBtn}>
                    {busy === "commit" ? "Importing…" : `Confirm & import ${preview.rows.length} employees`}
                  </button>
                )}
                <button onClick={() => setPreview(null)} className={smallBtn}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard title="Suggested salary and commission matches" action={<span className="rounded-full bg-base-800 px-2 py-0.5 text-[11px] text-ink-300">{suggestions.length} candidates</span>}>
          <p className="mb-3 text-xs text-ink-500">
            Based on a unique name or payment alias found in a salary/commission payment description. Review before applying; grouped
            payroll can be split manually below.
          </p>
          {suggestions.length ? (
            <>
              <div className="mb-2 flex flex-wrap gap-2">
                <button onClick={() => setSelectedMatches(new Set(suggestions.map((s) => s.transactionId)))} className={smallBtn}>
                  Select all candidates
                </button>
                <button onClick={() => setSelectedMatches(new Set())} className={smallBtn}>
                  Clear
                </button>
                <button onClick={linkMatches} disabled={!!busy || !selectedMatches.size} className={primaryBtn}>
                  {busy === "link" ? "Linking…" : `Link ${selectedMatches.size} reviewed payments`}
                </button>
              </div>
              <div className="max-h-[320px] overflow-auto rounded-xl border border-base-700">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 border-b border-base-700 bg-base-900 text-ink-500">
                    <tr>{["Select", "Payment", "Suggested person", "Job title", "Department", "Type", "Amount (USD)"].map((h) => <th key={h} className={`px-3 py-2 ${h.startsWith("Amount") ? "text-right" : ""}`}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {suggestions.map((s) => (
                      <tr key={s.transactionId} className="border-b border-base-800 text-ink-300 last:border-0">
                        <td className="px-3 py-1.5">
                          <input
                            type="checkbox"
                            checked={selectedMatches.has(s.transactionId)}
                            onChange={(e) =>
                              setSelectedMatches((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(s.transactionId);
                                else next.delete(s.transactionId);
                                return next;
                              })
                            }
                          />
                        </td>
                        <td className="max-w-[320px] px-3 py-1.5">
                          <p className="truncate font-medium text-ink-50" title={s.description}>{s.description}</p>
                          <p className="text-[10px] text-ink-500">{s.month} · {s.transactionId}</p>
                        </td>
                        <td className="px-3 py-1.5">{s.personName}</td>
                        <td className="px-3 py-1.5">{s.jobTitle}</td>
                        <td className="px-3 py-1.5">{s.department ?? "—"}</td>
                        <td className="px-3 py-1.5">{s.costType}</td>
                        <td className="px-3 py-1.5 text-right">{usd(s.amountUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-xs text-ink-500">No unique unassigned payroll matches. Import employees, then refresh this page. Payments with unclear matches should be assigned manually.</p>
          )}
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard title="Cost per person">
          <p className="mb-3 text-xs text-ink-500">
            Payment-level department snapshots are preserved when employees move departments. Later transfers do not rewrite historical months.
          </p>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-ink-500">
              Department
              <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs text-ink-50 outline-none">
                <option value="all">All departments</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-ink-500">
              Person
              <select value={filterPerson} onChange={(e) => setFilterPerson(e.target.value)} className="rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs text-ink-50 outline-none">
                <option value="all">All people</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
              </select>
            </label>
          </div>
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Person</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Job title</th>
                  <th className="px-3 py-2 text-right">Salary</th>
                  <th className="px-3 py-2 text-right">Commission</th>
                  <th className="px-3 py-2 text-right">Other employer costs</th>
                  <th className="px-3 py-2 text-right">Total cost</th>
                </tr>
              </thead>
              <tbody>
                {costPerPerson.map((row) => (
                  <tr key={row.personId} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="px-3 py-2 font-medium text-ink-50">{row.name}</td>
                    <td className="px-3 py-2">{row.department ?? "—"}</td>
                    <td className="px-3 py-2">{row.jobTitle || "—"}</td>
                    <td className="px-3 py-2 text-right">{usd(row.salary)}</td>
                    <td className="px-3 py-2 text-right">{usd(row.commission)}</td>
                    <td className="px-3 py-2 text-right">{usd(row.other)}</td>
                    <td className="px-3 py-2 text-right font-medium text-ink-50">{usd(row.total)}</td>
                  </tr>
                ))}
                {costPerPerson.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-ink-500">No staff payment allocations recorded for the selected period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </WidgetCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WidgetCard title={editingId ? "Edit employee" : "Register employee"}>
          <p className="mb-3 text-xs text-ink-500">Each person has one record, even if their department changes later.</p>
          <form onSubmit={submitPerson} className="mb-4 space-y-2">
            <label className={labelClass}>
              Employee full name
              <input value={form.name} maxLength={160} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Employee name" className={`${inputClass} normal-case tracking-normal`} />
            </label>
            <label className={labelClass}>
              Job title
              <input value={form.jobTitle} maxLength={160} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder="Sales Manager" className={`${inputClass} normal-case tracking-normal`} />
            </label>
            <label className={labelClass}>
              Email
              <input value={form.email} maxLength={200} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@onehomes.com" className={`${inputClass} normal-case tracking-normal`} />
            </label>
            <label className={labelClass}>
              Payment alias
              <input value={form.paymentAlias} maxLength={200} onChange={(e) => setForm({ ...form, paymentAlias: e.target.value })} placeholder="Name shown in ERP / bank" className={`${inputClass} normal-case tracking-normal`} />
            </label>
            <label className={labelClass}>
              Current department
              <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className={`${inputClass} normal-case tracking-normal`}>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-ink-300">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Active employee
            </label>
            {personError && <p className="text-xs text-status-inactive">{personError}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={!!busy || form.name.trim().length < 2 || !form.jobTitle.trim() || !form.department} className={`${primaryBtn} flex-1 py-2`}>
                {busy === "person" ? "Saving…" : editingId ? "Save employee" : "Add employee"}
              </button>
              {editingId && (
                <button type="button" onClick={resetPersonForm} className="rounded-lg border border-base-700 px-3 text-xs text-ink-300 hover:text-ink-50">
                  Cancel
                </button>
              )}
            </div>
          </form>
          <div className="flex max-h-[230px] flex-col gap-1 overflow-y-auto">
            {people.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-base-800">
                <span className="min-w-0 text-ink-300">
                  <span className="font-medium text-ink-50">{p.fullName}</span> · {p.department ?? "—"} · {p.jobTitle || <span className="text-status-alert">Job title missing</span>}
                  {!p.active && <span className="ml-1.5 rounded-full bg-status-inactive/15 px-1.5 py-0.5 text-[10px] text-status-inactive">Archived</span>}
                </span>
                <span className="flex shrink-0 gap-1.5">
                  <button onClick={() => chooseEmployee(p.id)} className={smallBtn}>Assign payments</button>
                  <button onClick={() => startEdit(p)} className={smallBtn}>Edit</button>
                </span>
              </div>
            ))}
          </div>
        </WidgetCard>

        <WidgetCard title="Find payroll and commission payments">
          <p className="mb-3 text-xs text-ink-500">
            Choose an employee, then search payment descriptions, references, suppliers or IDs. This search works across all financial years,
            independently of dashboard filters.
          </p>
          <div className="space-y-2">
            <label className={labelClass}>
              Employee to receive selected payments
              <select value={selectedEmployee} onChange={(e) => chooseEmployee(e.target.value)} className={`${inputClass} normal-case tracking-normal`}>
                <option value="">Select employee first</option>
                {people.filter((p) => p.active || p.id === selectedEmployee).map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName} ({p.department ?? "—"})</option>
                ))}
              </select>
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setQuery(queryInput);
              }}
              className="flex gap-2"
            >
              <input value={queryInput} onChange={(e) => setQueryInput(e.target.value)} placeholder="Employee name, supplier, payment ID, reference or commission" className={inputClass} />
              <button type="submit" className={smallBtn}>Search payments</button>
              <button type="button" onClick={() => { setQueryInput(""); setQuery(""); }} className={smallBtn}>Clear</button>
            </form>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-ink-500">
                <input type="checkbox" checked={onlyUnassigned} onChange={(e) => setOnlyUnassigned(e.target.checked)} />
                Has unallocated balance
              </label>
              <select value={scope} onChange={(e) => setScope(e.target.value as "personnel" | "all")} className="rounded-lg border border-base-700 bg-base-800 px-2 py-1 text-xs text-ink-50 outline-none">
                <option value="personnel">Salary and personnel costs</option>
                <option value="all">All payments</option>
              </select>
              <button
                disabled={!selectedEmployee || !displayed.length}
                onClick={() => setPicks((prev) => { const next = { ...prev }; displayed.forEach((t) => addPick(t, next)); return next; })}
                className={smallBtn}
              >
                Select shown ({displayed.length})
              </button>
              <button disabled={!pickEntries.length} onClick={() => setPicks({})} className={smallBtn}>Clear selected</button>
            </div>
          </div>
          <div className="mt-2 flex max-h-[335px] flex-col gap-1 overflow-y-auto">
            {displayed.map((t) => {
              const left = balance(t);
              const used = (usedCents.get(t.id) ?? 0) / 100;
              const picked = Boolean(picks[t.id]);
              return (
                <div key={t.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-base-800">
                  <label className="flex min-w-0 flex-1 items-center gap-2">
                    <input type="checkbox" checked={picked} disabled={!selectedEmployee || (!picked && left <= 0)} onChange={(e) => togglePick(t, e.target.checked)} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink-50" title={t.description}>{t.description}</span>
                      <span className="block text-[10px] text-ink-500">
                        {t.date ? String(t.date).slice(0, 10) : t.month} · {effectiveCentre(t) || "—"} · {usd(t.amount)} · Available {usd(left)}
                        {used ? ` · Already allocated ${usd(used)}` : ""}
                      </span>
                    </span>
                  </label>
                  <button onClick={() => openPayment(t.id)} className={`${smallBtn} shrink-0`}>Split / edit</button>
                </div>
              );
            })}
            {displayed.length === 0 && <p className="p-2 text-xs text-ink-500">No matching payments. Try a description, amount or reference. You can also choose All payments.</p>}
          </div>
          <p className="mt-2 text-[11px] text-ink-500">
            Showing {displayed.length} of {choices.length} matches. Tick multiple rows to add them below. Search matches payment descriptions across all years.
          </p>
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard
          title={`Allocate selected payments to ${selectedName ?? "an employee"}`}
          action={<span className="rounded-full bg-base-800 px-2 py-0.5 text-[11px] text-ink-300">{pickEntries.length} selected · {usd(pickTotal)}</span>}
        >
          <p className="mb-2 text-xs text-ink-500">Set a separate category and USD amount for each payment. Existing employee allocations are not overwritten.</p>
          {pickEntries.length ? (
            <div className="flex flex-col divide-y divide-base-800">
              {pickEntries.map(([id, p]) => {
                const t = txById.get(id);
                if (!t) return null;
                const set = (patch: Partial<Pick>) => setPicks((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
                return (
                  <div key={id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-ink-50" title={t.description}>{t.description}</p>
                        <p className="text-[10px] text-ink-500">{t.date ? String(t.date).slice(0, 10) : t.month} · {id} · {usd(t.amount)} original · {usd(balance(t))} available</p>
                      </div>
                      <button onClick={() => togglePick(t, false)} className={smallBtn}>Remove</button>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <label className={labelClass}>
                        Cost category
                        <select value={p.costType} onChange={(e) => set({ costType: e.target.value })} className={`${inputClass} normal-case tracking-normal`}>
                          {COST_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </label>
                      <label className={labelClass}>
                        Allocate USD
                        <input type="number" min="0.01" step="0.01" value={p.amountUsd} onChange={(e) => set({ amountUsd: e.target.value })} className={`${inputClass} normal-case tracking-normal`} />
                      </label>
                      <label className={labelClass}>
                        Payroll/deal reference
                        <input maxLength={180} placeholder="Optional" value={p.reference} onChange={(e) => set({ reference: e.target.value })} className={`${inputClass} normal-case tracking-normal`} />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-ink-500">Select an employee and tick payments in the search results above.</p>
          )}
          <button onClick={saveBatch} disabled={!!busy || !selectedEmployee || !pickEntries.length} className={`${primaryBtn} mt-3`}>
            {busy === "batch" ? "Allocating…" : `Allocate ${pickEntries.length} selected payments`}
          </button>
        </WidgetCard>
      </div>

      {editPayment && (
        <div className="mt-4">
          <WidgetCard
            title={`Split or edit a payment: ${editPayment.description}`}
            action={<button onClick={() => setEditPaymentId(null)} className="text-[11px] text-ink-500 hover:text-ink-300">Close</button>}
          >
            <p className="mb-3 text-xs text-ink-500">
              {editPayment.id} · {editPayment.date ? String(editPayment.date).slice(0, 10) : editPayment.month} · Original amount {usd(editPayment.amount)}
            </p>
            <p className="mb-3 rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-300">
              This editor replaces the complete personnel allocation for ONE payment. Use it if a payroll transfer covers several people. The
              sum cannot exceed the original payment amount.
            </p>
            <div className="flex flex-col gap-2">
              {draftLines.map((line) => (
                <div key={line.key} className="grid grid-cols-1 gap-2 rounded-lg border border-base-700 bg-base-800 p-2 sm:grid-cols-6">
                  <select value={line.personId} onChange={(e) => updateLine(line.key, { personId: e.target.value })} className="rounded-md border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-ink-50 outline-none">
                    <option value="">Select employee</option>
                    {people.map((p) => <option key={p.id} value={p.id}>{p.fullName} ({p.department ?? "—"})</option>)}
                  </select>
                  <select value={line.costType} onChange={(e) => updateLine(line.key, { costType: e.target.value })} className="rounded-md border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-ink-50 outline-none">
                    {COST_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="number" min="0.01" step="0.01" value={line.amountUsd} onChange={(e) => updateLine(line.key, { amountUsd: e.target.value })} placeholder="0.00" className="rounded-md border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-ink-50 outline-none placeholder:text-ink-500" />
                  <input value={line.reference} maxLength={180} onChange={(e) => updateLine(line.key, { reference: e.target.value })} placeholder="Deal, pay period or reference" className="rounded-md border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-ink-50 outline-none placeholder:text-ink-500" />
                  <input value={line.note} maxLength={500} onChange={(e) => updateLine(line.key, { note: e.target.value })} placeholder="Notes" className="rounded-md border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-ink-50 outline-none placeholder:text-ink-500" />
                  <button onClick={() => setDraftLines((prev) => prev.filter((l) => l.key !== line.key))} className="rounded-md border border-base-700 px-2 py-1.5 text-xs text-ink-500 hover:border-status-inactive/40 hover:text-status-inactive">
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button onClick={() => setDraftLines((prev) => [...prev, newDraftLine()])} className="rounded-lg border border-base-700 px-3 py-1.5 text-xs text-ink-300 hover:text-ink-50">
                + Add allocation line
              </button>
              <button onClick={() => saveAllocation()} disabled={!!busy || draftLines.length === 0} className={primaryBtn}>
                {busy === "alloc" ? "Saving…" : "Save payment allocations"}
              </button>
              {hasExisting && (
                <button onClick={() => saveAllocation(true)} disabled={!!busy} className="rounded-lg border border-status-inactive/40 px-3 py-1.5 text-xs font-medium text-status-inactive hover:bg-status-inactive/10 disabled:opacity-50">
                  Remove allocations
                </button>
              )}
              <span className="text-[11px] text-ink-500">Lines total: {usd(draftTotal)} of {usd(editPayment.amount)}</span>
              {draftTotal > editPayment.amount + 0.001 && <span className="text-[11px] text-status-alert">Allocations exceed the original payment amount.</span>}
              {allocError && <span className="text-[11px] text-status-inactive">{allocError}</span>}
            </div>
          </WidgetCard>
        </div>
      )}

      <div className="mt-4">
        <WidgetCard
          title="Commission and payroll history"
          action={<Link href="/finance/history" className="text-[11px] text-ink-300 hover:text-ink-50">Change History ↗</Link>}
        >
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Cost category</th>
                  <th className="px-3 py-2">Source payment / reference</th>
                  <th className="px-3 py-2 text-right">Attributed USD</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="px-3 py-2">{h.paymentDate ? String(h.paymentDate).slice(0, 10) : h.month}</td>
                    <td className="px-3 py-2 font-medium text-ink-50">{h.personName}</td>
                    <td className="px-3 py-2">{h.departmentSnapshot ?? "—"}</td>
                    <td className="px-3 py-2">{h.costType}</td>
                    <td className="max-w-[280px] px-3 py-2">
                      <p className="truncate" title={h.paymentDescription}>{h.paymentDescription}</p>
                      <p className="text-[10px] text-ink-500">{h.reference || h.transactionId}</p>
                    </td>
                    <td className="px-3 py-2 text-right">{usd(h.amountUsd)}</td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-ink-500">No allocations yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredAllocations.length > 200 && (
            <p className="mt-2 text-[11px] text-ink-500">
              Showing the latest 200 of {filteredAllocations.length.toLocaleString()} lines. Narrow the year, month, department or person for more detail.
            </p>
          )}
        </WidgetCard>
      </div>
    </div>
  );
}
