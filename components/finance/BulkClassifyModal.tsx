"use client";

import { useState } from "react";
import { X } from "lucide-react";

export function BulkClassifyModal({
  ids,
  departments,
  managementCostHeads,
  onClose,
  onSaved,
}: {
  ids: string[];
  departments: string[];
  managementCostHeads: string[];
  onClose: () => void;
  onSaved: (updated: { department: string; costHead: string }) => void;
}) {
  const [department, setDepartment] = useState("");
  const [costHead, setCostHead] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/ledger/bulk-classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, department, costHead, note: note || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to bulk classify");
      }
      onSaved({ department, costHead });
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
          <h2 className="text-sm font-medium text-ink-50">Bulk classify {ids.length.toLocaleString()} payment(s)</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <select value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass}>
            <option value="">Department…</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select value={costHead} onChange={(e) => setCostHead(e.target.value)} className={inputClass}>
            <option value="">Cost head…</option>
            {managementCostHeads.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            rows={2}
            className={inputClass}
          />
          {error && <p className="text-xs text-status-inactive">{error}</p>}
          <button
            type="submit"
            disabled={isSaving || !department || !costHead}
            className="w-full rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
          >
            {isSaving ? "Classifying…" : "Apply to all selected"}
          </button>
        </form>
      </div>
    </div>
  );
}
