"use client";

import { useState } from "react";
import { FolderTree, Tags, Plus, Shuffle } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

const inputClass =
  "w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500";

function splitIds(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  );
}

function AddNameForm({
  placeholder,
  endpoint,
  onAdded,
}: {
  placeholder: string;
  endpoint: string;
  onAdded: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving || !name.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to create");
      }
      onAdded(data?.name ?? name.trim());
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mb-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          className={inputClass}
        />
        <button
          type="submit"
          disabled={isSaving || !name.trim()}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
          {isSaving ? "Adding…" : "Add"}
        </button>
      </form>
      {error && <p className="mt-1.5 text-[11px] text-status-inactive">{error}</p>}
    </div>
  );
}

function NameList({ names }: { names: string[] }) {
  if (names.length === 0) {
    return <p className="text-xs text-ink-500">None defined yet.</p>;
  }
  return (
    <div className="max-h-64 space-y-1 overflow-y-auto">
      {names.map((n) => (
        <div
          key={n}
          className="rounded-lg border border-base-800 bg-base-800/60 px-3 py-1.5 text-xs text-ink-300"
        >
          {n}
        </div>
      ))}
    </div>
  );
}

export function OrganiseCostsPage({
  initialDepartments,
  initialCostHeads,
}: {
  initialDepartments: string[];
  initialCostHeads: string[];
}) {
  const [departments, setDepartments] = useState(initialDepartments);
  const [costHeads, setCostHeads] = useState(initialCostHeads);

  const [bulkDepartment, setBulkDepartment] = useState("");
  const [bulkCostHead, setBulkCostHead] = useState("");
  const [bulkIds, setBulkIds] = useState("");
  const [bulkNote, setBulkNote] = useState("");
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  function addDepartment(name: string) {
    setDepartments((prev) => (prev.includes(name) ? prev : [...prev, name].sort()));
  }
  function addCostHead(name: string) {
    setCostHeads((prev) => (prev.includes(name) ? prev : [...prev, name].sort()));
  }

  async function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ids = splitIds(bulkIds);
    if (isBulkSaving || !bulkDepartment || !bulkCostHead || ids.length === 0) return;
    setIsBulkSaving(true);
    setBulkError(null);
    setBulkResult(null);
    try {
      const res = await fetch("/api/finance/ledger/bulk-classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids,
          department: bulkDepartment,
          costHead: bulkCostHead,
          note: bulkNote || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to reclassify payments");
      }
      setBulkResult(`${data.updated} payment(s) reclassified to ${bulkDepartment} / ${bulkCostHead}.`);
      setBulkIds("");
      setBulkNote("");
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Failed to reclassify payments");
    } finally {
      setIsBulkSaving(false);
    }
  }

  const idCount = splitIds(bulkIds).length;

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Organise Costs</h1>
          <p className="mt-1 text-sm text-ink-500">
            Manage the management-reporting taxonomy — departments, cost heads, and bulk reclassification.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WidgetCard title="Departments" icon={FolderTree}>
          <AddNameForm
            placeholder="New department name"
            endpoint="/api/finance/departments"
            onAdded={addDepartment}
          />
          <NameList names={departments} />
        </WidgetCard>

        <WidgetCard title="Cost Heads" icon={Tags}>
          <AddNameForm
            placeholder="New cost head name"
            endpoint="/api/finance/cost-heads"
            onAdded={addCostHead}
          />
          <NameList names={costHeads} />
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard title="Bulk Reclassify Payments" icon={Shuffle}>
          <form onSubmit={handleBulkSubmit} className="space-y-2.5">
            <p className="text-xs text-ink-500">
              Paste payment IDs (comma or newline separated), choose a department and cost head, and apply the
              classification to all of them at once.
            </p>
            <textarea
              value={bulkIds}
              onChange={(e) => setBulkIds(e.target.value)}
              placeholder="Payment IDs — one per line or comma separated"
              rows={5}
              className={`${inputClass} font-mono`}
            />
            <p className="text-[11px] text-ink-500">{idCount} payment id(s) detected</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                value={bulkDepartment}
                onChange={(e) => setBulkDepartment(e.target.value)}
                className={inputClass}
              >
                <option value="">Select department…</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                value={bulkCostHead}
                onChange={(e) => setBulkCostHead(e.target.value)}
                className={inputClass}
              >
                <option value="">Select cost head…</option>
                {costHeads.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={bulkNote}
              onChange={(e) => setBulkNote(e.target.value)}
              placeholder="Note (optional)"
              className={inputClass}
            />
            {bulkError && <p className="text-xs text-status-inactive">{bulkError}</p>}
            {bulkResult && <p className="text-xs text-status-active">{bulkResult}</p>}
            <button
              type="submit"
              disabled={isBulkSaving || !bulkDepartment || !bulkCostHead || idCount === 0}
              className="rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
            >
              {isBulkSaving ? "Applying…" : `Reclassify ${idCount || ""} payment(s)`}
            </button>
          </form>
        </WidgetCard>
      </div>
    </div>
  );
}
