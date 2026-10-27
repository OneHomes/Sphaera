"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

// Direct structural/content port of the source app's People Costs
// screen — same header copy, same 4 KPI cards, same "cost per person"
// panel with department/person filters, same two-column "register
// employee" + "find payroll/commission payments" layout, same per-payment
// allocation editor (repeatable person/cost-type/amount/reference/note
// rows), and same closing allocation-history table. Only the visual
// implementation (WidgetCard/Tailwind) replaces the original's bespoke
// CSS.

const COST_TYPES = ["Salary", "Commission", "Bonus", "Employer taxes", "Benefits", "Other personnel"] as const;

type Person = {
  id: string;
  fullName: string;
  department: string | null;
  active: boolean;
};

type Allocation = {
  id: string;
  transactionId: string;
  personId: string;
  costType: string;
  amountUsd: number;
  departmentSnapshot: string | null;
  reference: string | null;
  note: string | null;
  updatedAt: string | Date;
  paymentDescription: string;
  month: string;
  paymentDate: string | Date;
  paymentAmount: number;
  personName: string;
};

type PersonCostState = {
  people: Person[];
  allocations: Allocation[];
  costTypes: string[];
};

type PaymentOption = {
  id: string;
  date: string | Date;
  description: string;
  amount: number;
  managementCostHead: string | null;
  managementDepartment: string | null;
};

type AllocationLineDraft = {
  key: string;
  personId: string;
  costType: string;
  amountUsd: string;
  reference: string;
  note: string;
};

function usd(value: number): string {
  return `${value < 0 ? "-" : ""}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

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

export function PeopleCostsPage({
  state,
  departments,
  payments,
}: {
  state: PersonCostState;
  departments: string[];
  payments: PaymentOption[];
}) {
  const [people, setPeople] = useState<Person[]>(state.people);
  const [allocations, setAllocations] = useState<Allocation[]>(state.allocations);

  // --- Cost per person -----------------------------------------------
  const [filterDept, setFilterDept] = useState<string>("all");
  const [filterPerson, setFilterPerson] = useState<string>("all");

  const totalsByType = useMemo(() => {
    const t: Record<string, number> = {};
    for (const a of allocations) t[a.costType] = (t[a.costType] ?? 0) + a.amountUsd;
    return t;
  }, [allocations]);
  const attributedSalary = totalsByType["Salary"] ?? 0;
  const attributedCommission = totalsByType["Commission"] ?? 0;
  const otherEmployerCosts = ["Bonus", "Employer taxes", "Benefits", "Other personnel"].reduce(
    (s, k) => s + (totalsByType[k] ?? 0),
    0
  );
  const totalAttributed = allocations.reduce((s, a) => s + a.amountUsd, 0);

  const filteredAllocations = useMemo(() => {
    return allocations.filter((a) => {
      if (filterDept !== "all" && (a.departmentSnapshot ?? "") !== filterDept) return false;
      if (filterPerson !== "all" && a.personId !== filterPerson) return false;
      return true;
    });
  }, [allocations, filterDept, filterPerson]);

  const costPerPerson = useMemo(() => {
    const map = new Map<
      string,
      { personId: string; name: string; department: string | null; salary: number; commission: number; other: number; total: number }
    >();
    for (const a of filteredAllocations) {
      const entry = map.get(a.personId) ?? {
        personId: a.personId,
        name: a.personName,
        department: a.departmentSnapshot,
        salary: 0,
        commission: 0,
        other: 0,
        total: 0,
      };
      if (a.costType === "Salary") entry.salary += a.amountUsd;
      else if (a.costType === "Commission") entry.commission += a.amountUsd;
      else entry.other += a.amountUsd;
      entry.total += a.amountUsd;
      // Most-recent allocation (allocations arrive ordered month desc)
      // wins for the displayed "current" department snapshot.
      map.set(a.personId, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredAllocations]);

  const snapshotDepartments = useMemo(
    () => Array.from(new Set(allocations.map((a) => a.departmentSnapshot).filter((d): d is string => Boolean(d)))).sort(),
    [allocations]
  );

  // --- Register employee ----------------------------------------------
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState(departments[0] ?? "");
  const [active, setActive] = useState(true);
  const [personSaving, setPersonSaving] = useState(false);
  const [personError, setPersonError] = useState<string | null>(null);

  function startEdit(p: Person) {
    setEditingPerson(p);
    setName(p.fullName);
    setDepartment(p.department ?? departments[0] ?? "");
    setActive(p.active);
    setPersonError(null);
  }

  function resetPersonForm() {
    setEditingPerson(null);
    setName("");
    setDepartment(departments[0] ?? "");
    setActive(true);
    setPersonError(null);
  }

  async function submitPerson(e: React.FormEvent) {
    e.preventDefault();
    if (personSaving) return;
    setPersonSaving(true);
    setPersonError(null);
    try {
      const res = await fetch("/api/finance/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingPerson?.id, name, department, active }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to save employee");
      const saved: Person = { id: data.id, fullName: name.trim().split(/\s+/).join(" "), department, active };
      setPeople((prev) => {
        const exists = prev.some((p) => p.id === saved.id);
        if (exists) return prev.map((p) => (p.id === saved.id ? saved : p));
        return [...prev, saved].sort((a, b) => a.fullName.localeCompare(b.fullName));
      });
      resetPersonForm();
    } catch (err) {
      setPersonError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPersonSaving(false);
    }
  }

  // --- Find payroll/commission payments --------------------------------
  const [paymentSearch, setPaymentSearch] = useState("");
  const [onlyUnattributed, setOnlyUnattributed] = useState(false);
  const attributedIds = useMemo(() => new Set(allocations.map((a) => a.transactionId)), [allocations]);

  const matchingPayments = useMemo(() => {
    const q = paymentSearch.trim().toLowerCase();
    return payments.filter((p) => {
      if (onlyUnattributed && attributedIds.has(p.id)) return false;
      if (q && !p.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [payments, paymentSearch, onlyUnattributed, attributedIds]);

  // --- Allocation editor -------------------------------------------------
  const [selectedPayment, setSelectedPayment] = useState<PaymentOption | null>(null);
  const [draftLines, setDraftLines] = useState<AllocationLineDraft[]>([]);
  const [allocSaving, setAllocSaving] = useState(false);
  const [allocError, setAllocError] = useState<string | null>(null);

  function openAllocation(payment: PaymentOption) {
    setSelectedPayment(payment);
    setAllocError(null);
    const existing = allocations.filter((a) => a.transactionId === payment.id);
    setDraftLines(
      existing.length > 0
        ? existing.map((a) => ({
            key: a.id,
            personId: a.personId,
            costType: a.costType,
            amountUsd: String(a.amountUsd),
            reference: a.reference ?? "",
            note: a.note ?? "",
          }))
        : [newDraftLine()]
    );
  }

  function closeAllocation() {
    setSelectedPayment(null);
    setDraftLines([]);
    setAllocError(null);
  }

  function updateDraftLine(key: string, patch: Partial<AllocationLineDraft>) {
    setDraftLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeDraftLine(key: string) {
    setDraftLines((prev) => prev.filter((l) => l.key !== key));
  }

  const draftTotal = draftLines.reduce((s, l) => s + (parseFloat(l.amountUsd) || 0), 0);
  const draftExceeds = selectedPayment ? draftTotal > Math.abs(selectedPayment.amount) + 0.001 : false;

  const hasExistingAllocations = selectedPayment
    ? allocations.some((a) => a.transactionId === selectedPayment.id)
    : false;

  function removeAllAllocations() {
    setDraftLines([]);
    saveAllocation([]);
  }

  async function saveAllocation(linesOverride?: AllocationLineDraft[]) {
    if (!selectedPayment || allocSaving) return;
    setAllocSaving(true);
    setAllocError(null);
    try {
      const sourceLines = linesOverride ?? draftLines;
      const lines = sourceLines
        .filter((l) => l.personId && l.amountUsd)
        .map((l) => ({
          personId: l.personId,
          costType: l.costType,
          amountUsd: l.amountUsd,
          reference: l.reference,
          note: l.note,
        }));
      const res = await fetch("/api/finance/people/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: selectedPayment.id, lines }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to save person allocations");

      // Rebuild the allocation list locally: drop old lines for this
      // payment, add the freshly saved set.
      setAllocations((prev) => {
        const kept = prev.filter((a) => a.transactionId !== selectedPayment.id);
        const added: Allocation[] = lines.map((l, i) => {
          const person = people.find((p) => p.id === l.personId);
          return {
            id: `${selectedPayment.id}-${i}-${Date.now()}`,
            transactionId: selectedPayment.id,
            personId: l.personId,
            costType: l.costType,
            amountUsd: Number(l.amountUsd),
            departmentSnapshot: person?.department ?? null,
            reference: l.reference ?? null,
            note: l.note ?? null,
            updatedAt: new Date().toISOString(),
            paymentDescription: selectedPayment.description,
            month: new Date(selectedPayment.date).toISOString().slice(0, 7),
            paymentDate: selectedPayment.date,
            paymentAmount: selectedPayment.amount,
            personName: person?.fullName ?? "",
          };
        });
        return [...added, ...kept];
      });
      closeAllocation();
    } catch (err) {
      setAllocError(err instanceof Error ? err.message : "Failed");
    } finally {
      setAllocSaving(false);
    }
  }

  const history = useMemo(
    () =>
      [...allocations]
        .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
        .slice(0, 200),
    [allocations]
  );

  const inputClass =
    "w-full rounded-lg border border-base-700 bg-base-800 px-2.5 py-1.5 text-xs text-ink-50 outline-none placeholder:text-ink-500";

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-ink-50">People costs · salary and commissions</h2>
        <p className="mt-1 text-sm text-ink-500">
          Attribute actual supplier, payroll and commission payments to individual people. These are allocations
          against existing ledger rows, not additional expenses. Values shown in USD.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Attributed salary" value={usd(attributedSalary)} detail="Within current financial filters" />
        <Kpi title="Attributed commission" value={usd(attributedCommission)} detail="Linked to individual employees" />
        <Kpi title="Other employer costs" value={usd(otherEmployerCosts)} detail="Bonus, employer taxes, benefits, other" />
        <Kpi title="Total attributed people cost" value={usd(totalAttributed)} detail="Sum of assigned payments, not additional spend" />
      </div>

      <div className="mt-4">
        <WidgetCard title="Cost per person">
          <p className="mb-3 text-xs text-ink-500">
            Each employee&apos;s department is captured at the time of allocation. Later department transfers do not
            rewrite historical months.
          </p>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-ink-500">
              Department
              <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs text-ink-50 outline-none">
                <option value="all">All departments</option>
                {snapshotDepartments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-xs text-ink-500">
              Person
              <select value={filterPerson} onChange={(e) => setFilterPerson(e.target.value)} className="rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs text-ink-50 outline-none">
                <option value="all">All people</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Person</th>
                  <th className="px-3 py-2">Department</th>
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
                    <td className="px-3 py-2 text-right">{usd(row.salary)}</td>
                    <td className="px-3 py-2 text-right">{usd(row.commission)}</td>
                    <td className="px-3 py-2 text-right">{usd(row.other)}</td>
                    <td className="px-3 py-2 text-right font-medium text-ink-50">{usd(row.total)}</td>
                  </tr>
                ))}
                {costPerPerson.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-ink-500">
                      No staff payment allocations recorded for the selected period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </WidgetCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WidgetCard title={editingPerson ? "Edit employee" : "Register employee"}>
          <p className="mb-3 text-xs text-ink-500">
            Maintain one person record even if their department later changes. Historic allocations retain their
            original department.
          </p>
          <form onSubmit={submitPerson} className="mb-4 space-y-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={inputClass} />
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass}>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-xs text-ink-300">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              Active
            </label>
            {personError && <p className="text-xs text-status-inactive">{personError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={personSaving || name.trim().length < 2 || !department}
                className="flex-1 rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
              >
                {personSaving ? "Saving…" : editingPerson ? "Save changes" : "Add employee"}
              </button>
              {editingPerson && (
                <button type="button" onClick={resetPersonForm} className="rounded-lg border border-base-700 px-3 text-xs text-ink-300 hover:text-ink-50">
                  Cancel
                </button>
              )}
            </div>
          </form>
          <div className="flex max-h-[260px] flex-col gap-1 overflow-y-auto">
            {people.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-base-800">
                <span className="text-ink-300">
                  <span className="font-medium text-ink-50">{p.fullName}</span> · {p.department ?? "—"}
                  {!p.active && <span className="ml-1.5 rounded-full bg-status-inactive/15 px-1.5 py-0.5 text-[10px] text-status-inactive">Inactive</span>}
                </span>
                <button onClick={() => startEdit(p)} className="rounded-md border border-base-700 px-2 py-0.5 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50">
                  Edit
                </button>
              </div>
            ))}
          </div>
        </WidgetCard>

        <WidgetCard title="Find payroll and commission payments">
          <p className="mb-3 text-xs text-ink-500">
            Search existing payments. You can divide one payment between many people, and assign salary and
            commission separately.
          </p>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <input
              value={paymentSearch}
              onChange={(e) => setPaymentSearch(e.target.value)}
              placeholder="Search payment descriptions…"
              className="flex-1 rounded-lg border border-base-700 bg-base-800 px-2.5 py-1.5 text-xs text-ink-50 outline-none placeholder:text-ink-500"
            />
            <label className="flex items-center gap-1.5 text-xs text-ink-500">
              <input type="checkbox" checked={onlyUnattributed} onChange={(e) => setOnlyUnattributed(e.target.checked)} />
              Only not yet attributed
            </label>
          </div>
          <div className="flex max-h-[300px] flex-col gap-1 overflow-y-auto">
            {matchingPayments.slice(0, 80).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-base-800">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink-50" title={p.description}>
                    {p.description}
                  </p>
                  <p className="text-[10px] text-ink-500">
                    {new Date(p.date).toLocaleDateString()} · {p.managementCostHead ?? "—"} · {usd(p.amount)}
                    {attributedIds.has(p.id) && <span className="ml-1.5 text-status-active">· attributed</span>}
                  </p>
                </div>
                <button
                  onClick={() => openAllocation(p)}
                  className="shrink-0 rounded-md border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50"
                >
                  Allocate
                </button>
              </div>
            ))}
            {matchingPayments.length === 0 && <p className="p-2 text-xs text-ink-500">No payroll-eligible payments match this search.</p>}
          </div>
          <p className="mt-2 text-[11px] text-ink-500">
            Showing {Math.min(80, matchingPayments.length)} of {matchingPayments.length}. Narrow search to find a
            particular payment.
          </p>
        </WidgetCard>
      </div>

      {selectedPayment && (
        <div className="mt-4">
          <WidgetCard
            title={`Allocate payment: ${selectedPayment.description}`}
            action={
              <button onClick={closeAllocation} className="text-[11px] text-ink-500 hover:text-ink-300">
                Close
              </button>
            }
          >
            <p className="mb-3 text-xs text-ink-500">
              {selectedPayment.id} · {new Date(selectedPayment.date).toLocaleDateString()} · Original amount:{" "}
              {usd(selectedPayment.amount)}
            </p>
            <p className="mb-3 rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-300">
              Select an employee, type of cost, and exact USD amount on each line. The sum cannot exceed the
              payment. Deal or payroll references can be recorded against each commission or salary line.
            </p>
            <div className="flex flex-col gap-2">
              {draftLines.map((line) => (
                <div key={line.key} className="grid grid-cols-1 gap-2 rounded-lg border border-base-700 bg-base-800 p-2 sm:grid-cols-6">
                  <select
                    value={line.personId}
                    onChange={(e) => updateDraftLine(line.key, { personId: e.target.value })}
                    className="rounded-md border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-ink-50 outline-none"
                  >
                    <option value="">Choose person…</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName}
                      </option>
                    ))}
                  </select>
                  <select
                    value={line.costType}
                    onChange={(e) => updateDraftLine(line.key, { costType: e.target.value })}
                    className="rounded-md border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-ink-50 outline-none"
                  >
                    {COST_TYPES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input
                    value={line.amountUsd}
                    onChange={(e) => updateDraftLine(line.key, { amountUsd: e.target.value })}
                    placeholder="USD amount"
                    className="rounded-md border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-ink-50 outline-none placeholder:text-ink-500"
                  />
                  <input
                    value={line.reference}
                    onChange={(e) => updateDraftLine(line.key, { reference: e.target.value })}
                    placeholder="Reference"
                    className="rounded-md border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-ink-50 outline-none placeholder:text-ink-500"
                  />
                  <input
                    value={line.note}
                    onChange={(e) => updateDraftLine(line.key, { note: e.target.value })}
                    placeholder="Note"
                    className="rounded-md border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-ink-50 outline-none placeholder:text-ink-500"
                  />
                  <button
                    onClick={() => removeDraftLine(line.key)}
                    className="rounded-md border border-base-700 px-2 py-1.5 text-xs text-ink-500 hover:border-status-inactive/40 hover:text-status-inactive"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setDraftLines((prev) => [...prev, newDraftLine()])}
                className="rounded-lg border border-base-700 px-3 py-1.5 text-xs text-ink-300 hover:text-ink-50"
              >
                + Add a person
              </button>
              <button
                onClick={() => saveAllocation()}
                disabled={allocSaving || draftLines.length === 0}
                className="rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
              >
                {allocSaving ? "Saving…" : "Save person allocations"}
              </button>
              {hasExistingAllocations && (
                <button
                  onClick={removeAllAllocations}
                  disabled={allocSaving}
                  className="rounded-lg border border-status-inactive/40 px-3 py-1.5 text-xs font-medium text-status-inactive hover:bg-status-inactive/10 disabled:opacity-50"
                >
                  Remove all allocations
                </button>
              )}
              <span className="text-[11px] text-ink-500">
                Lines total: {usd(draftTotal)} of {usd(selectedPayment.amount)}
              </span>
              {draftExceeds && (
                <span className="text-[11px] text-status-alert">Allocations exceed the original payment amount.</span>
              )}
              {allocError && <span className="text-[11px] text-status-inactive">{allocError}</span>}
            </div>
            <p className="mt-3 text-[11px] text-ink-500">
              Changes are audited and undoable via Change History. Unallocated amounts remain visible until fully
              attributed.
            </p>
          </WidgetCard>
        </div>
      )}

      <div className="mt-4">
        <WidgetCard
          title="Commission and payroll allocation history"
          action={
            <Link href="/finance/history" className="text-[11px] text-ink-300 hover:text-ink-50">
              Change History ↗
            </Link>
          }
        >
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Person</th>
                  <th className="px-3 py-2">Department at payment</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Source payment / ref</th>
                  <th className="px-3 py-2 text-right">USD attributed</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="px-3 py-2">{new Date(h.paymentDate).toLocaleDateString()}</td>
                    <td className="px-3 py-2 font-medium text-ink-50">{h.personName}</td>
                    <td className="px-3 py-2">{h.departmentSnapshot ?? "—"}</td>
                    <td className="px-3 py-2">{h.costType}</td>
                    <td className="max-w-[240px] truncate px-3 py-2" title={h.paymentDescription}>
                      {h.paymentDescription}
                      {h.reference ? ` · ${h.reference}` : ""}
                    </td>
                    <td className="px-3 py-2 text-right">{usd(h.amountUsd)}</td>
                  </tr>
                ))}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-ink-500">
                      No allocation history recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {allocations.length > 200 && (
            <p className="mt-2 text-[11px] text-ink-500">
              Showing the latest 200 of {allocations.length.toLocaleString()} lines. Narrow the year, month,
              department or person for more detail.
            </p>
          )}
        </WidgetCard>
      </div>
    </div>
  );
}
