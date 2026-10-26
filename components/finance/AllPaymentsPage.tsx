"use client";

import { useMemo, useState } from "react";
import { Search, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { FinanceLedgerRow, FinanceState } from "@/lib/finance/ledgerData";
import { ClassifyModal } from "./ClassifyModal";
import { DisputeModal } from "./DisputeModal";

const PAGE_SIZE = 50;

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

export function AllPaymentsPage({
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
  const [department, setDepartment] = useState<string>("all");
  const [month, setMonth] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [classifyTarget, setClassifyTarget] = useState<FinanceLedgerRow | null>(null);
  const [disputeTarget, setDisputeTarget] = useState<FinanceLedgerRow | null>(null);

  const months = useMemo(() => {
    const set = new Set(rows.map((r) => r.month));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.description.toLowerCase().includes(q)) return false;
      if (month !== "all" && r.month !== month) return false;
      if (department === "unclassified") return !r.managementDepartment;
      if (department !== "all" && r.managementDepartment !== department) return false;
      return true;
    });
  }, [rows, search, department, month]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function resetToFirstPage() {
    setPage(0);
  }

  function applyFilter(fn: () => void) {
    fn();
    resetToFirstPage();
  }

  const totalSpend = filtered.reduce((sum, t) => sum + t.amount, 0);
  const unclassifiedCount = filtered.filter((t) => !t.managementDepartment).length;
  const disputedCount = filtered.filter((t) => t.dispute && t.dispute.status !== "Resolved").length;

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">All Payments</h1>
          <p className="mt-1 text-sm text-ink-500">{rows.length.toLocaleString()} payment(s) in the ledger</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tile label="Visible spend" value={formatUsd(totalSpend)} />
        <Tile label="Unclassified" value={unclassifiedCount.toLocaleString()} />
        <Tile label="Open disputes" value={disputedCount.toLocaleString()} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" />
          <input
            value={search}
            onChange={(e) => applyFilter(() => setSearch(e.target.value))}
            placeholder="Search description…"
            className="w-64 rounded-lg border border-base-700 bg-base-800 py-1.5 pl-8 pr-3 text-xs text-ink-50 outline-none placeholder:text-ink-500"
          />
        </div>
        <select
          value={month}
          onChange={(e) => applyFilter(() => setMonth(e.target.value))}
          className="rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs text-ink-50 outline-none"
        >
          <option value="all">All months</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => applyFilter(() => setDepartment("all"))}
          className={`rounded-full px-3 py-1 text-xs ${
            department === "all" ? "bg-ink-50 text-base-950" : "border border-base-700 text-ink-500 hover:text-ink-300"
          }`}
        >
          All
        </button>
        <button
          onClick={() => applyFilter(() => setDepartment("unclassified"))}
          className={`rounded-full px-3 py-1 text-xs ${
            department === "unclassified"
              ? "bg-ink-50 text-base-950"
              : "border border-base-700 text-ink-500 hover:text-ink-300"
          }`}
        >
          Unclassified
        </button>
        {departments.map((d) => (
          <button
            key={d}
            onClick={() => applyFilter(() => setDepartment(d))}
            className={`rounded-full px-3 py-1 text-xs ${
              department === d ? "bg-ink-50 text-base-950" : "border border-base-700 text-ink-500 hover:text-ink-300"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-base-700">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-base-700 bg-base-900 text-ink-500">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Department</th>
              <th className="px-3 py-2">Cost head</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Reviewed</th>
              <th className="px-3 py-2">Dispute</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {pageRows.map((t) => (
              <tr
                key={t.id}
                onClick={() => setClassifyTarget(t)}
                className="cursor-pointer border-b border-base-800 text-ink-300 last:border-0 hover:bg-base-800/60"
              >
                <td className="px-3 py-2">{new Date(t.date).toLocaleDateString()}</td>
                <td className="max-w-[260px] truncate px-3 py-2 text-ink-50" title={t.description}>
                  {t.description}
                </td>
                <td className="px-3 py-2">
                  {t.managementDepartment ?? (
                    <span className="rounded-full bg-status-alert/15 px-2 py-0.5 text-[11px] font-medium text-status-alert">
                      Unclassified
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">{t.managementCostHead ?? "—"}</td>
                <td className="px-3 py-2">{formatUsd(t.amount)}</td>
                <td className="px-3 py-2">
                  {t.reviewed ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-status-active" strokeWidth={1.75} />
                  ) : (
                    <span className="text-ink-600">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {t.dispute ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        t.dispute.status === "Resolved"
                          ? "bg-status-active/15 text-status-active"
                          : t.dispute.status === "Under review"
                          ? "bg-status-alert/15 text-status-alert"
                          : "bg-status-inactive/15 text-status-inactive"
                      }`}
                    >
                      {t.dispute.status}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2">
                  {!t.dispute && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDisputeTarget(t);
                      }}
                      title="File a dispute"
                      className="flex items-center gap-1 rounded-md border border-base-700 px-1.5 py-0.5 text-[10px] text-ink-500 hover:text-status-inactive"
                    >
                      <AlertTriangle className="h-3 w-3" strokeWidth={1.75} />
                      Dispute
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-ink-500">
                  No payments match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-between text-xs text-ink-500">
          <span>
            Page {page + 1} of {totalPages} · {filtered.length.toLocaleString()} result(s)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-lg border border-base-700 px-2.5 py-1 text-ink-300 hover:text-ink-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-lg border border-base-700 px-2.5 py-1 text-ink-300 hover:text-ink-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {classifyTarget && (
        <ClassifyModal
          transaction={classifyTarget}
          departments={departments}
          managementCostHeads={managementCostHeads}
          costHeads={costHeads}
          onClose={() => setClassifyTarget(null)}
          onSaved={(updated) => {
            setRows((prev) =>
              prev.map((r) =>
                r.id === classifyTarget.id
                  ? { ...r, managementDepartment: updated.department, managementCostHead: updated.costHead }
                  : r
              )
            );
            setClassifyTarget(null);
          }}
        />
      )}

      {disputeTarget && (
        <DisputeModal
          transactionId={disputeTarget.id}
          description={disputeTarget.description}
          existing={disputeTarget.dispute}
          onClose={() => setDisputeTarget(null)}
          onSaved={(updated) => {
            setRows((prev) =>
              prev.map((r) =>
                r.id === disputeTarget.id
                  ? {
                      ...r,
                      dispute: { status: updated.status, reason: updated.reason, financeOwner: updated.financeOwner },
                    }
                  : r
              )
            );
            setDisputeTarget(null);
          }}
        />
      )}
    </div>
  );
}
