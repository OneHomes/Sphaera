"use client";

import { useMemo, useState } from "react";
import { Users, UserPlus, Wallet, Building2, X } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

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

function formatUsd(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-base-700 bg-base-800 p-3">
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink-50">{value}</p>
    </div>
  );
}

function PersonModal({
  departments,
  person,
  onClose,
  onSaved,
}: {
  departments: string[];
  person: Person | null;
  onClose: () => void;
  onSaved: (person: Person) => void;
}) {
  const [name, setName] = useState(person?.fullName ?? "");
  const [department, setDepartment] = useState(person?.department ?? departments[0] ?? "");
  const [active, setActive] = useState(person?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: person?.id, name, department, active }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to save employee");
      onSaved({ id: data.id, fullName: name.trim().split(/\s+/).join(" "), department, active });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-50">{person ? "Edit Employee" : "New Employee"}</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className={inputClass}
          />
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
          {error && <p className="text-xs text-status-inactive">{error}</p>}
          <button
            type="submit"
            disabled={saving || name.trim().length < 2 || !department}
            className="w-full rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save employee"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function PeopleCostsPage({
  state,
  departments,
}: {
  state: PersonCostState;
  departments: string[];
}) {
  const [people, setPeople] = useState<Person[]>(state.people);
  const [modalPerson, setModalPerson] = useState<Person | null | "new">(null);
  const [groupBy, setGroupBy] = useState<"person" | "department">("person");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const totalAllocated = useMemo(
    () => state.allocations.reduce((sum, a) => sum + a.amountUsd, 0),
    [state.allocations]
  );
  const activeCount = people.filter((p) => p.active).length;

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; total: number; lines: Allocation[] }>();
    for (const a of state.allocations) {
      const key = groupBy === "person" ? a.personId : a.departmentSnapshot ?? "(no department)";
      const label = groupBy === "person" ? a.personName : a.departmentSnapshot ?? "No department snapshot";
      const entry = map.get(key) ?? { label, total: 0, lines: [] };
      entry.total += a.amountUsd;
      entry.lines.push(a);
      map.set(key, entry);
    }
    return Array.from(map.entries())
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => b.total - a.total);
  }, [state.allocations, groupBy]);

  const selectedGroup = groups.find((g) => g.key === selectedKey) ?? groups[0] ?? null;

  function handlePersonSaved(p: Person) {
    setPeople((prev) => {
      const exists = prev.some((existing) => existing.id === p.id);
      if (exists) return prev.map((existing) => (existing.id === p.id ? { ...existing, ...p } : existing));
      return [...prev, p].sort((a, b) => a.fullName.localeCompare(b.fullName));
    });
    setModalPerson(null);
  }

  async function toggleActive(person: Person) {
    const next = { ...person, active: !person.active };
    setPeople((prev) => prev.map((p) => (p.id === person.id ? next : p)));
    try {
      const res = await fetch("/api/finance/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: person.id, name: person.fullName, department: person.department, active: next.active }),
      });
      if (!res.ok) throw new Error("Failed to update");
    } catch {
      setPeople((prev) => prev.map((p) => (p.id === person.id ? person : p)));
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">People Costs</h1>
          <p className="mt-1 text-sm text-ink-500">Employee registry and personnel cost attribution.</p>
        </div>
        <button
          onClick={() => setModalPerson("new")}
          className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white"
        >
          <UserPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
          Add employee
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <WidgetCard title="Employees" icon={Users}>
          <Tile label="Total registered" value={people.length.toLocaleString()} />
        </WidgetCard>
        <WidgetCard title="Active" icon={Users}>
          <Tile label="Currently active" value={activeCount.toLocaleString()} />
        </WidgetCard>
        <WidgetCard title="Total Attributed" icon={Wallet}>
          <Tile label="Across all personnel cost lines" value={formatUsd(totalAllocated)} />
        </WidgetCard>
        <WidgetCard title="Departments" icon={Building2}>
          <Tile label="With attributed cost" value={new Set(state.allocations.map((a) => a.departmentSnapshot)).size.toLocaleString()} />
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard title="Employee Registry" icon={Users}>
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="px-3 py-2 font-medium text-ink-50">{p.fullName}</td>
                    <td className="px-3 py-2">{p.department ?? "—"}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => toggleActive(p)}>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            p.active ? "bg-status-active/15 text-status-active" : "bg-status-inactive/15 text-status-inactive"
                          }`}
                        >
                          {p.active ? "Active" : "Inactive"}
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => setModalPerson(p)}
                        className="rounded-md border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {people.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-ink-500">
                      No employees registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </WidgetCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WidgetCard
          title="Cost Allocations"
          icon={Wallet}
          action={
            <div className="flex gap-1 rounded-lg border border-base-700 p-0.5 text-[11px]">
              {(["person", "department"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => {
                    setGroupBy(g);
                    setSelectedKey(null);
                  }}
                  className={`rounded-md px-2 py-1 ${groupBy === g ? "bg-base-800 text-ink-50" : "text-ink-500"}`}
                >
                  By {g}
                </button>
              ))}
            </div>
          }
        >
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">{groupBy === "person" ? "Employee" : "Department"}</th>
                  <th className="px-3 py-2"># Lines</th>
                  <th className="px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr
                    key={g.key}
                    onClick={() => setSelectedKey(g.key)}
                    className={`cursor-pointer border-b border-base-800 text-ink-300 last:border-0 hover:bg-base-800/60 ${
                      selectedGroup?.key === g.key ? "bg-base-800/60" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-medium text-ink-50">{g.label}</td>
                    <td className="px-3 py-2">{g.lines.length}</td>
                    <td className="px-3 py-2">{formatUsd(g.total)}</td>
                  </tr>
                ))}
                {groups.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-ink-500">
                      No personnel cost allocations recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </WidgetCard>

        <WidgetCard title={selectedGroup ? `Lines · ${selectedGroup.label}` : "Lines"} icon={Wallet}>
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Month</th>
                  <th className="px-3 py-2">Payment</th>
                  <th className="px-3 py-2">Cost type</th>
                  <th className="px-3 py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(selectedGroup?.lines ?? []).map((line) => (
                  <tr key={line.id} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="px-3 py-2">{line.month}</td>
                    <td className="max-w-[180px] truncate px-3 py-2" title={line.paymentDescription}>
                      {line.paymentDescription}
                    </td>
                    <td className="px-3 py-2">{line.costType}</td>
                    <td className="px-3 py-2">{formatUsd(line.amountUsd)}</td>
                  </tr>
                ))}
                {(!selectedGroup || selectedGroup.lines.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-ink-500">
                      Select a row on the left to see its allocation lines.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </WidgetCard>
      </div>

      {modalPerson && (
        <PersonModal
          departments={departments}
          person={modalPerson === "new" ? null : modalPerson}
          onClose={() => setModalPerson(null)}
          onSaved={handlePersonSaved}
        />
      )}
    </div>
  );
}
