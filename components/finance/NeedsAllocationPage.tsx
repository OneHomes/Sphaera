"use client";

import { useMemo, useState } from "react";
import type { FinanceLedgerRow, FinanceState } from "@/lib/finance/ledgerData";
import { ClassifyModal } from "./ClassifyModal";
import { PaymentsTable } from "./PaymentsTable";
import { BulkPaymentToolbar } from "./BulkPaymentToolbar";

// Direct structural/content port of the source app's reviewPage()
// (index.html line 1040) — same 4 KPI cards, same verbatim collections
// warning banner, same shared bulk-allocate toolbar and payments table as
// paymentPage(). Only the visual implementation changes.

function usd(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

function Kpi({ title, value, detail, color }: { title: string; value: string; detail: string; color?: "amber" }) {
  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <h4 className="text-[11px] text-ink-500">{title}</h4>
      <div className={`mt-1 text-xl font-semibold ${color === "amber" ? "text-status-alert" : "text-ink-50"}`}>
        {value}
      </div>
      <div className="mt-1 text-[11px] text-ink-500">{detail}</div>
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageIds, setPageIds] = useState<string[]>([]);
  const [classifyTarget, setClassifyTarget] = useState<FinanceLedgerRow | null>(null);

  const tx = useMemo(() => rows.filter((t) => !t.managementDepartment), [rows]);
  const others = useMemo(
    () => rows.filter((t) => t.reviewGroup === "Accounting review" && Boolean(t.managementDepartment)),
    [rows]
  );

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
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-50">Allocate unidentified payments</h1>
        <p className="mt-1 text-sm text-ink-500">
          Choose any registered department and a simple cost head. Create a new head in Organise Costs when needed.
          Original source records never change.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          title="Missing classifications"
          value={String(tx.length)}
          detail="Payments needing a complete cost head"
          color="amber"
        />
        <Kpi
          title="Value to reconcile"
          value={usd(tx.reduce((s, t) => s + t.amount, 0), true)}
          detail="May include collections and other non-expenses"
          color="amber"
        />
        <Kpi title="Additional accounting reviews" value={String(others.length)} detail="Classified entries still flagged for review" />
        <Kpi title="Original Finance labels" value={String(costHeads.length)} detail="Legacy source labels are preserved for audit" />
      </div>

      <div className="mb-4 rounded-xl border border-status-alert/40 bg-status-alert/10 p-3 text-xs text-status-alert">
        Some unidentified payments are labelled collections, not expenditure. Please confirm their nature with Finance
        before allocating to an operating cost head, to avoid distorting your budget.
      </div>

      <BulkPaymentToolbar
        mode="review"
        tx={tx}
        pageIds={pageIds}
        selected={selected}
        setSelected={setSelected}
        departments={departments}
        managementCostHeads={managementCostHeads}
        onApplied={(ids) => removeClassified(ids)}
      />

      <PaymentsTable
        rows={tx}
        selectable
        selected={selected}
        onToggle={(id) =>
          setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          })
        }
        onToggleAllPage={(ids, shouldSelect) =>
          setSelected((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => (shouldSelect ? next.add(id) : next.delete(id)));
            return next;
          })
        }
        onRowClick={(row) => setClassifyTarget(row)}
        onPageIdsChange={setPageIds}
      />

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
    </div>
  );
}
