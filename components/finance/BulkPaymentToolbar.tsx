"use client";

import { useState } from "react";
import type { FinanceLedgerRow } from "@/lib/finance/ledgerData";

// Direct structural port of the source app's shared bulkPaymentToolbar()
// render function (index.html line 1045), used by both paymentPage() and
// reviewPage() in the original. Lets the user tick payments (this page,
// all filtered, or individually) and reclassify them in one bulk-classify
// call, matching the source's "Reclassify N selected payments" flow.

const MAX_BULK_PAYMENTS = 5000;

function usd(value: number): string {
  return `${value < 0 ? "-" : ""}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

export function BulkPaymentToolbar({
  mode,
  tx,
  pageIds,
  selected,
  setSelected,
  departments,
  managementCostHeads,
  onApplied,
}: {
  mode: "review" | "payments";
  tx: FinanceLedgerRow[];
  pageIds: string[];
  selected: Set<string>;
  setSelected: (next: Set<string>) => void;
  departments: string[];
  managementCostHeads: string[];
  onApplied: (ids: string[], department: string, costHead: string) => void;
}) {
  const [department, setDepartment] = useState("");
  const [costHead, setCostHead] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ids = new Set(tx.map((t) => t.id));
  const selectedInScope = Array.from(selected).filter((id) => ids.has(id));
  const selectedPayments = tx.filter((t) => selected.has(t.id));
  const allPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  function selectPage() {
    const next = new Set(selected);
    if (allPage) {
      pageIds.forEach((id) => next.delete(id));
    } else {
      pageIds.forEach((id) => next.add(id));
    }
    setSelected(next);
  }

  function selectAllFiltered() {
    setSelected(new Set(tx.map((t) => t.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function handleApply() {
    if (isSaving || selectedInScope.length === 0 || !department || !costHead) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/ledger/bulk-classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedInScope, department, costHead }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to reclassify payments");
      }
      onApplied(selectedInScope, department, costHead);
      setDepartment("");
      setCostHead("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reclassify payments");
    } finally {
      setIsSaving(false);
    }
  }

  const inputClass =
    "rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs text-ink-50 outline-none";

  return (
    <div className="mb-4 rounded-xl border border-base-700 bg-base-900 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-ink-50">
            {mode === "review" ? "Bulk allocate unidentified payments" : "Reclassify multiple payments"}
          </h3>
          <p className="mt-1 max-w-xl text-[11px] text-ink-500">
            {mode === "review"
              ? "Tick individual rows, select this page, or select all filtered payments."
              : "Tick payments to update their department and cost head in one action."}{" "}
            Original transaction details and debt tags remain unchanged.
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            selectedInScope.length ? "bg-status-active/15 text-status-active" : "border border-base-700 text-ink-500"
          }`}
        >
          {selectedInScope.length} selected
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          onClick={selectPage}
          disabled={pageIds.length === 0}
          className="rounded-lg border border-base-700 px-2.5 py-1 text-[11px] text-ink-300 hover:text-ink-50 disabled:opacity-40"
        >
          {allPage ? "Clear page selection" : `Select this page (${pageIds.length})`}
        </button>
        <button
          onClick={selectAllFiltered}
          disabled={tx.length === 0 || tx.length > MAX_BULK_PAYMENTS}
          className="rounded-lg border border-base-700 px-2.5 py-1 text-[11px] text-ink-300 hover:text-ink-50 disabled:opacity-40"
        >
          Select all filtered ({tx.length.toLocaleString()})
        </button>
        <button
          onClick={clearSelection}
          disabled={selectedInScope.length === 0}
          className="rounded-lg border border-base-700 px-2.5 py-1 text-[11px] text-ink-300 hover:text-ink-50 disabled:opacity-40"
        >
          Clear selection
        </button>
        {tx.length > MAX_BULK_PAYMENTS && (
          <span className="self-center text-[11px] text-ink-500">
            Narrow the filters to {MAX_BULK_PAYMENTS.toLocaleString()} payments or fewer per operation.
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass}>
          <option value="">Assign department…</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select value={costHead} onChange={(e) => setCostHead(e.target.value)} className={inputClass}>
          <option value="">Assign cost head…</option>
          {managementCostHeads.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          onClick={handleApply}
          disabled={isSaving || selectedInScope.length === 0 || !department || !costHead}
          className="rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
        >
          {isSaving ? "Applying…" : `Reclassify ${selectedInScope.length} selected payments`}
        </button>
      </div>

      {error && <p className="mt-2 text-[11px] text-status-inactive">{error}</p>}

      {selectedInScope.length > 0 && (
        <p className="mt-3 text-[11px] text-ink-500">
          This action affects exactly <b className="text-ink-300">{selectedInScope.length}</b> selected payments
          totalling <b className="text-ink-300">{usd(selectedPayments.reduce((s, t) => s + t.amount, 0))}</b>. A
          single Change History entry lets you undo this allocation if no later edits conflict.
        </p>
      )}
    </div>
  );
}
