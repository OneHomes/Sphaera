"use client";

import { useMemo, useState } from "react";
import { Pencil } from "lucide-react";
import type { FinanceLedgerRow } from "@/lib/finance/ledgerData";
import { DisputeModal } from "./DisputeModal";

const STATUS_FILTERS = ["all", "Open", "Under review", "Resolved"] as const;

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

function statusBadgeClass(status: string): string {
  if (status === "Resolved") return "bg-status-active/15 text-status-active";
  if (status === "Under review") return "bg-status-alert/15 text-status-alert";
  return "bg-status-inactive/15 text-status-inactive";
}

export function DisputedChargesPage({ transactions }: { transactions: FinanceLedgerRow[] }) {
  const [rows, setRows] = useState(transactions);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [target, setTarget] = useState<FinanceLedgerRow | null>(null);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((r) => r.dispute?.status === statusFilter);
  }, [rows, statusFilter]);

  const openCount = rows.filter((r) => r.dispute?.status === "Open").length;
  const underReviewCount = rows.filter((r) => r.dispute?.status === "Under review").length;
  const resolvedCount = rows.filter((r) => r.dispute?.status === "Resolved").length;

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Disputed Charges</h1>
          <p className="mt-1 text-sm text-ink-500">{rows.length.toLocaleString()} payment(s) under dispute</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tile label="Open" value={openCount.toLocaleString()} />
        <Tile label="Under review" value={underReviewCount.toLocaleString()} />
        <Tile label="Resolved" value={resolvedCount.toLocaleString()} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs ${
              statusFilter === s ? "bg-ink-50 text-base-950" : "border border-base-700 text-ink-500 hover:text-ink-300"
            }`}
          >
            {s === "all" ? "All" : s}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-base-700">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-base-700 bg-base-900 text-ink-500">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">Finance owner</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-b border-base-800 text-ink-300 last:border-0 hover:bg-base-800/60">
                <td className="px-3 py-2">{new Date(t.date).toLocaleDateString()}</td>
                <td className="max-w-[240px] truncate px-3 py-2 text-ink-50" title={t.description}>
                  {t.description}
                </td>
                <td className="px-3 py-2">{formatUsd(t.amount)}</td>
                <td className="px-3 py-2">
                  {t.dispute && (
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusBadgeClass(t.dispute.status)}`}>
                      {t.dispute.status}
                    </span>
                  )}
                </td>
                <td className="max-w-[260px] truncate px-3 py-2" title={t.dispute?.reason ?? ""}>
                  {t.dispute?.reason ?? "—"}
                </td>
                <td className="px-3 py-2">{t.dispute?.financeOwner ?? "—"}</td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => setTarget(t)}
                    className="flex items-center gap-1 rounded-md border border-base-700 px-2 py-0.5 text-[10px] text-ink-300 hover:text-ink-50"
                  >
                    <Pencil className="h-3 w-3" strokeWidth={1.75} />
                    Update
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-ink-500">
                  No disputes match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {target && (
        <DisputeModal
          transactionId={target.id}
          description={target.description}
          existing={target.dispute}
          onClose={() => setTarget(null)}
          onSaved={(updated) => {
            setRows((prev) =>
              prev.map((r) =>
                r.id === target.id
                  ? {
                      ...r,
                      dispute: { status: updated.status, reason: updated.reason, financeOwner: updated.financeOwner },
                    }
                  : r
              )
            );
            setTarget(null);
          }}
        />
      )}
    </div>
  );
}
