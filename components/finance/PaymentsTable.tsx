"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { FinanceLedgerRow } from "@/lib/finance/ledgerData";

// Direct structural port of the source app's shared txTable() render
// function (index.html line 1038), used by both paymentPage() and
// reviewPage() in the original. Column set narrowed per the rebuild spec
// to: select / date / payee-description / department-or-unclassified /
// cost head / amount / historical-debt type / review-dispute action.
// Pagination matches the source's fixed 30-row page.

const PAGE_SIZE = 30;

function usd(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

export function PaymentsTable({
  rows,
  selectable = false,
  selected,
  onToggle,
  onToggleAllPage,
  onRowClick,
  onDispute,
  onPageIdsChange,
}: {
  rows: FinanceLedgerRow[];
  selectable?: boolean;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAllPage?: (ids: string[], shouldSelect: boolean) => void;
  onRowClick?: (row: FinanceLedgerRow) => void;
  onDispute?: (row: FinanceLedgerRow) => void;
  onPageIdsChange?: (ids: string[]) => void;
}) {
  const [page, setPage] = useState(0);
  const maxPage = Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1);
  const safePage = Math.min(page, maxPage);
  const pageRows = rows.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const pageIds = pageRows.map((r) => r.id);
  const allVisiblePage = pageIds.length > 0 && selected ? pageIds.every((id) => selected.has(id)) : false;
  const pageIdsKey = pageIds.join(",");

  useEffect(() => {
    onPageIdsChange?.(pageIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIdsKey]);

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-base-700">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-base-700 bg-base-900 text-ink-500">
            <tr>
              {selectable && (
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allVisiblePage}
                    onChange={() => onToggleAllPage?.(pageIds, !allVisiblePage)}
                    title="Select all payments on this page"
                    className="h-3.5 w-3.5 rounded border-base-700 bg-base-800"
                  />
                </th>
              )}
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Payee / payment description</th>
              <th className="px-3 py-2">Department / cost head</th>
              <th className="px-3 py-2">USD</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Review</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((t) => (
              <tr key={t.id} className="border-b border-base-800 text-ink-300 last:border-0 hover:bg-base-800/60">
                {selectable && (
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected?.has(t.id) ?? false}
                      onChange={() => onToggle?.(t.id)}
                      className="h-3.5 w-3.5 rounded border-base-700 bg-base-800"
                    />
                  </td>
                )}
                <td className="whitespace-nowrap px-3 py-2">
                  {new Date(t.date).toLocaleDateString()}
                </td>
                <td
                  className="max-w-[320px] cursor-pointer px-3 py-2"
                  onClick={() => onRowClick?.(t)}
                >
                  <div className="truncate text-ink-50" title={t.description}>
                    {t.description}
                  </div>
                  <div className="truncate text-[11px] text-ink-500">{t.month}</div>
                </td>
                <td className="px-3 py-2 cursor-pointer" onClick={() => onRowClick?.(t)}>
                  {t.managementDepartment ? (
                    <span className="text-ink-50">{t.managementDepartment}</span>
                  ) : (
                    <span className="rounded-full bg-status-alert/15 px-2 py-0.5 text-[11px] font-medium text-status-alert">
                      Unclassified
                    </span>
                  )}
                  <div className="text-[11px] text-ink-500">{t.managementCostHead ?? "—"}</div>
                </td>
                <td className="px-3 py-2 font-medium text-ink-50">{usd(t.amount)}</td>
                <td className="px-3 py-2">
                  {t.debtPeriod === "current" ? (
                    <span className="rounded-full border border-base-700 px-2 py-0.5 text-[11px] text-ink-300">
                      Current FY
                    </span>
                  ) : (
                    <span className="rounded-full bg-[#7965bd]/15 px-2 py-0.5 text-[11px] font-medium text-[#7965bd]">
                      Historical {t.debtPeriod}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    {t.dispute?.status && t.dispute.status !== "Resolved" ? (
                      <span className="rounded-full bg-status-inactive/15 px-2 py-0.5 text-[11px] font-medium text-status-inactive">
                        ⚑ {t.dispute.status}
                      </span>
                    ) : t.reviewed ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-status-active" strokeWidth={1.75} />
                    ) : (
                      <span className="text-ink-600">—</span>
                    )}
                    {onDispute && !t.dispute && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDispute(t);
                        }}
                        title="File a dispute"
                        className="flex items-center gap-1 rounded-md border border-base-700 px-1.5 py-0.5 text-[10px] text-ink-500 hover:text-status-inactive"
                      >
                        <AlertTriangle className="h-3 w-3" strokeWidth={1.75} />
                        Dispute
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={selectable ? 7 : 6} className="px-3 py-6 text-center text-ink-500">
                  No payments match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-500">
        <span>
          Showing {rows.length ? safePage * PAGE_SIZE + 1 : 0} to {Math.min((safePage + 1) * PAGE_SIZE, rows.length)} of{" "}
          {rows.length.toLocaleString()} payments
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="rounded-lg border border-base-700 px-2.5 py-1 text-ink-300 hover:text-ink-50 disabled:opacity-40"
          >
            ← Previous
          </button>
          <button
            onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
            disabled={safePage >= maxPage}
            className="rounded-lg border border-base-700 px-2.5 py-1 text-ink-300 hover:text-ink-50 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
