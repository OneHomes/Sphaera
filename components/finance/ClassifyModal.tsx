"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { FinanceLedgerRow, FinanceState } from "@/lib/finance/ledgerData";

const DEBT_PERIODS = ["current", "2024/25", "older"] as const;

export function ClassifyModal({
  transaction,
  departments,
  managementCostHeads,
  costHeads,
  onClose,
  onSaved,
}: {
  transaction: FinanceLedgerRow;
  departments: string[];
  managementCostHeads: string[];
  costHeads: FinanceState["costHeads"];
  onClose: () => void;
  onSaved: (updated: { department: string | null; costHead: string | null }) => void;
}) {
  const initialPair =
    transaction.effectiveHead && transaction.effectiveCentre
      ? `${transaction.effectiveHead}\u0000${transaction.effectiveCentre}`
      : "";

  const [department, setDepartment] = useState(transaction.managementDepartment ?? "");
  const [costHead, setCostHead] = useState(transaction.managementCostHead ?? "");
  const [pair, setPair] = useState(initialPair);
  const [debtPeriod, setDebtPeriod] = useState(transaction.debtPeriod || "current");
  const [reviewed, setReviewed] = useState(transaction.reviewed);
  const [note, setNote] = useState(transaction.note ?? "");
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
      const [head, centre] = pair ? pair.split("\u0000") : ["", ""];
      const res = await fetch("/api/finance/ledger/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: transaction.id,
          head: head || undefined,
          centre: centre || undefined,
          debtPeriod,
          department: department || undefined,
          costHead: costHead || undefined,
          note: note || undefined,
          reviewed,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to classify payment");
      }
      onSaved({ department: department || null, costHead: costHead || null });
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
          <div>
            <h2 className="text-sm font-medium text-ink-50">Classify payment</h2>
            <p className="mt-0.5 max-w-xs truncate text-[11px] text-ink-500" title={transaction.description}>
              {transaction.description}
            </p>
          </div>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div className="flex gap-2">
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
          </div>

          <select value={pair} onChange={(e) => setPair(e.target.value)} className={inputClass}>
            <option value="">Original cost-head / centre (optional)…</option>
            {costHeads.map((c) => (
              <option key={c.id} value={`${c.head}\u0000${c.centre}`}>
                {c.head} — {c.centre}
              </option>
            ))}
          </select>

          <select value={debtPeriod} onChange={(e) => setDebtPeriod(e.target.value)} className={inputClass}>
            {DEBT_PERIODS.map((p) => (
              <option key={p} value={p}>
                {p}
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

          <label className="flex items-center gap-2 text-xs text-ink-300">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-base-700 bg-base-800"
            />
            Mark as reviewed
          </label>

          {error && <p className="text-xs text-status-inactive">{error}</p>}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
          >
            {isSaving ? "Saving…" : "Save classification"}
          </button>
        </form>
      </div>
    </div>
  );
}
