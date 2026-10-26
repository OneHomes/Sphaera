"use client";

import { useMemo, useState } from "react";
import { Search, Layers } from "lucide-react";
import type { FinanceLedgerRow, FinanceState } from "@/lib/finance/ledgerData";
import { ClassifyModal } from "./ClassifyModal";
import { BulkClassifyModal } from "./BulkClassifyModal";

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

export function NeedsAllocationPage({
  transactions,
  departments,
  managementCostHeads,
  costHeads,
}: {
  transactions: FinanceLedgerRow[];
  departments: string[];
  managementCostHeads: string[];
  costHeads: FinanceState["costHeads"];
}) {
  const [rows, setRows] = useState(transactions);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [classifyTarget, setClassifyTarget] = useState<FinanceLedgerRow | null>(null);
  const [showBulk, setShowBulk] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.description.toLowerCase().includes(q));
  }, [rows, search]);

  const totalUnallocated = filtered.reduce((sum, t) => sum + t.amount, 0);
  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        filtered.forEach((r) => next.delete(r.id));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach((r) => next.add(r.id));
      return next;
    });
  }

  function removeClassified(ids: string[]) {
    setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Needs Allocation</h1>
          <p className="mt-1 text-sm text-ink-500">
            {rows.length.toLocaleString()} payment(s) without a management department
          </p>
        </div>
        <button
          onClick={() => setShowBulk(true)}
          disabled={selected.size === 0}
          className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
        >
          <Layers className="h-3.5 w-3.5" strokeWidth={1.75} />
          Bulk classify ({selected.size})
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Tile label="Unallocated amount" value={formatUsd(totalUnallocated)} />
        <Tile label="Selected" value={selected.size.toLocaleString()} />
      </div>

      <div className="mb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description…"
            className="w-64 rounded-lg border border-base-700 bg-base-800 py-1.5 pl-8 pr-3 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-base-700">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-base-700 bg-base-900 text-ink-500">
            <tr>
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  className="h-3.5 w-3.5 rounded border-base-700 bg-base-800"
                />
              </th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Month</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-b border-base-800 text-ink-300 last:border-0 hover:bg-base-800/60">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(t.id)}
                    onChange={() => toggle(t.id)}
                    className="h-3.5 w-3.5 rounded border-base-700 bg-base-800"
                  />
                </td>
                <td className="px-3 py-2">{new Date(t.date).toLocaleDateString()}</td>
                <td
                  className="max-w-[320px] cursor-pointer truncate px-3 py-2 text-ink-50"
                  title={t.description}
                  onClick={() => setClassifyTarget(t)}
                >
                  {t.description}
                </td>
                <td className="px-3 py-2">{formatUsd(t.amount)}</td>
                <td className="px-3 py-2">{t.month}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => setClassifyTarget(t)}
                    className="rounded-md border border-base-700 px-2 py-0.5 text-[10px] text-ink-300 hover:text-ink-50"
                  >
                    Classify
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-ink-500">
                  Nothing left to allocate.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {classifyTarget && (
        <ClassifyModal
          transaction={classifyTarget}
          departments={departments}
          managementCostHeads={managementCostHeads}
          costHeads={costHeads}
          onClose={() => setClassifyTarget(null)}
          onSaved={(updated) => {
            if (updated.department) {
              removeClassified([classifyTarget.id]);
            } else {
              setRows((prev) =>
                prev.map((r) =>
                  r.id === classifyTarget.id
                    ? { ...r, managementDepartment: updated.department, managementCostHead: updated.costHead }
                    : r
                )
              );
            }
            setClassifyTarget(null);
          }}
        />
      )}

      {showBulk && (
        <BulkClassifyModal
          ids={Array.from(selected)}
          departments={departments}
          managementCostHeads={managementCostHeads}
          onClose={() => setShowBulk(false)}
          onSaved={() => {
            removeClassified(Array.from(selected));
            setShowBulk(false);
          }}
        />
      )}
    </div>
  );
}
