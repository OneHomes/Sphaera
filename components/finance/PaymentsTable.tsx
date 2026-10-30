"use client";

import { useEffect } from "react";
import type { FinanceLedgerRow } from "@/lib/finance/ledgerData";
import { effectiveCentre, effectiveHead, hasCostSplit, isUnidentified, mo } from "@/lib/finance/financeReporting";
import { useFinanceLookups } from "./FinanceFilterContext";
import { LIST_PAGE, ListSearch, ShowMoreBar, useListSearch, useShowMore } from "./ShowMore";

// Port of the source txTable(): reference/source column, shared-cost splits and review status.
// Sphaera: first 10 rows with "Show more", plus a search box for the rows on this table.

function usd(value: number): string {
  return `${value < 0 ? "-" : ""}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

const pill = "rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap";

export function PaymentsTable({
  rows,
  selectable = false,
  selected,
  onToggle,
  onToggleAllPage,
  onRowClick,
  onDispute,
  onPageIdsChange,
  sourceNames,
  subscriptionNames,
}: {
  rows: FinanceLedgerRow[];
  selectable?: boolean;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAllPage?: (ids: string[], shouldSelect: boolean) => void;
  onRowClick?: (row: FinanceLedgerRow) => void;
  onDispute?: (row: FinanceLedgerRow) => void;
  onPageIdsChange?: (ids: string[]) => void;
  sourceNames?: Map<string, string>;
  subscriptionNames?: Map<string, string>;
}) {
  const lookups = useFinanceLookups();
  sourceNames = sourceNames ?? lookups.sourceNames;
  subscriptionNames = subscriptionNames ?? lookups.subscriptionNames;
  // Its own search box (description, reference, department, cost head, amount, month).
  const search = useListSearch(rows, (x) => [
    x.description,
    x.paymentReference,
    effectiveHead(x),
    effectiveCentre(x),
    x.month,
    x.country,
    Math.round(x.amount),
  ]);
  const filteredRows = search.filtered;
  // First 10, then "Show more" (resets when the rows or the search change).
  const more = useShowMore(filteredRows, `${filteredRows.length}|${filteredRows[0]?.id ?? ""}|${search.query}`);
  const pageRows = more.visible;
  const pageIds = pageRows.map((r) => r.id);
  const allVisiblePage = pageIds.length > 0 && selected ? pageIds.every((id) => selected.has(id)) : false;
  const pageIdsKey = pageIds.join(",");

  useEffect(() => {
    onPageIdsChange?.(pageIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIdsKey]);

  function reviewCell(x: FinanceLedgerRow) {
    if (x.dispute?.status && x.dispute.status !== "Resolved") {
      return (
        <div className="flex items-center gap-1.5">
          <span className={`${pill} bg-status-inactive/15 text-status-inactive`}>⚑ {x.dispute.status}</span>
          <button
            onClick={() => onRowClick?.(x)}
            className="rounded-md border border-base-700 px-1.5 py-0.5 text-[10px] text-ink-300 hover:text-ink-50"
          >
            Review
          </button>
        </div>
      );
    }
    const status = isUnidentified(x) ? (
      <span className={`${pill} bg-status-alert/15 text-status-alert`}>Unclassified</span>
    ) : x.reviewed ? (
      <span className={`${pill} bg-status-active/15 text-status-active`}>Reviewed</span>
    ) : x.reviewGroup === "Accounting review" ? (
      <span className={`${pill} bg-status-inactive/15 text-status-inactive`}>Review</span>
    ) : (
      <span className={`${pill} border border-base-700 text-ink-300`}>Recorded</span>
    );
    return (
      <div className="flex items-center gap-1.5">
        {status}
        {onDispute && !x.dispute && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDispute(x);
            }}
            title="File a dispute"
            className="rounded-md border border-base-700 px-1.5 py-0.5 text-[10px] text-ink-500 hover:text-status-inactive"
          >
            ⚑
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {rows.length > LIST_PAGE && (
        <div className="mb-2 flex items-center gap-2">
          <ListSearch value={search.query} onChange={search.setQuery} placeholder="Filter these payments (name, reference, amount…)" />
          {search.query && (
            <span className="text-[11px] text-ink-500">
              {filteredRows.length.toLocaleString()} of {rows.length.toLocaleString()} match
            </span>
          )}
        </div>
      )}
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
                    title="Select all payments shown"
                    className="h-3.5 w-3.5 rounded border-base-700 bg-base-800"
                  />
                </th>
              )}
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Payee / payment description</th>
              <th className="px-3 py-2">Bank reference / source</th>
              <th className="px-3 py-2">Department / cost head</th>
              <th className="px-3 py-2 text-right">USD</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Review</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((x) => (
              <tr key={x.id} className="border-b border-base-800 align-top text-ink-300 last:border-0 hover:bg-base-800/60">
                {selectable && (
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected?.has(x.id) ?? false}
                      onChange={() => onToggle?.(x.id)}
                      className="h-3.5 w-3.5 rounded border-base-700 bg-base-800"
                    />
                  </td>
                )}
                <td className="whitespace-nowrap px-3 py-2">{x.date ? new Date(x.date).toISOString().slice(0, 10) : mo(x.month)}</td>
                <td className="max-w-[370px] px-3 py-2">
                  <button onClick={() => onRowClick?.(x)} className="text-left font-medium text-ink-50 hover:underline">
                    {x.description}
                  </button>
                  <div className="text-[11px] text-ink-500">
                    {x.subscriptionId ? `↻ ${subscriptionNames?.get(x.subscriptionId) ?? "Subscription"} · ` : ""}
                    {x.country ?? ""} · {x.sourceSheet || "Imported"}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="text-[11px]">
                    {x.paymentReference ? (
                      <span className="text-ink-300">{x.paymentReference}</span>
                    ) : (
                      <span className={`${pill} bg-status-alert/15 text-status-alert`}>Missing reference</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-ink-500">
                    {(x.paymentSourceId && sourceNames?.get(x.paymentSourceId)) || "Source not identified"}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {hasCostSplit(x) ? (
                    <>
                      <span className={`${pill} bg-status-active/15 text-status-active`}>
                        Shared cost · {x.departmentSplits.length} departments
                      </span>
                      <div className="mt-0.5 text-[11px] text-ink-500">
                        {x.departmentSplits.map((z) => `${z.department} ${usd(z.amountUsd)}`).join(" · ")}
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="text-ink-50">{effectiveHead(x)}</span>
                      <div className="text-[11px] text-ink-500">{effectiveCentre(x)}</div>
                    </>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-ink-50">{usd(x.amount)}</td>
                <td className="px-3 py-2">
                  {x.debtPeriod === "current" ? (
                    <span className={`${pill} border border-base-700 text-ink-300`}>Current FY</span>
                  ) : (
                    <span className={`${pill} bg-[#8167b8]/15 text-[#8167b8]`}>Historical {x.debtPeriod}</span>
                  )}
                </td>
                <td className="px-3 py-2">{reviewCell(x)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {pageRows.length === 0 && <p className="px-3 py-6 text-center text-xs text-ink-500">No payments match these filters.</p>}
      </div>
      {filteredRows.length <= LIST_PAGE && filteredRows.length > 0 && (
        <p className="mt-2 text-[11px] text-ink-500">{filteredRows.length.toLocaleString()} payments</p>
      )}
      <ShowMoreBar state={more} />
    </div>
  );
}
