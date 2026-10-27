"use client";

import { useEffect, useMemo, useState } from "react";
import type { FinanceLedgerRow, FinanceState } from "@/lib/finance/ledgerData";
import { ClassifyModal } from "./ClassifyModal";
import { PaymentsTable } from "./PaymentsTable";
import { BulkPaymentToolbar } from "./BulkPaymentToolbar";
import { useFilteredFinanceRows } from "./FinanceFilterContext";

// Direct structural/content port of the source app's reviewPage()
// (index.html line 1040) — same 4 KPI cards, same verbatim collections
// warning banner, same shared bulk-allocate toolbar, same
// reviewRepeatGroups() "repeated payments" panel, and the same payments
// table as paymentPage(). Only the visual implementation changes.

function usd(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (compact && Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `${value < 0 ? "-" : ""}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

type RepeatGroup = { key: string; label: string; ids: string[]; amount: number; count: number };

// Direct port of the source's recurringGroups(): payments that share an
// identical description across more than one distinct date (the same
// payee charging repeatedly) — most such groups first, capped at 8, same
// as the original's reviewRepeatGroups(tx).
function recurringGroups(tx: FinanceLedgerRow[]): RepeatGroup[] {
  const map = new Map<string, { label: string; ids: string[]; amount: number; dates: Set<string> }>();
  for (const t of tx) {
    const label = (t.description || "").trim();
    if (!label) continue;
    const key = label.toLowerCase();
    const dateKey = t.date ? new Date(t.date).toISOString().slice(0, 10) : "";
    const existing = map.get(key);
    if (existing) {
      existing.ids.push(t.id);
      existing.amount += t.amount;
      existing.dates.add(dateKey);
    } else {
      map.set(key, { label, ids: [t.id], amount: t.amount, dates: new Set([dateKey]) });
    }
  }
  return Array.from(map.entries())
    .filter(([, g]) => g.ids.length > 1 && g.dates.size > 1)
    .map(([key, g]) => ({ key, label: g.label, ids: g.ids, amount: g.amount, count: g.ids.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function ReviewRepeatGroups({
  tx,
  selected,
  setSelected,
}: {
  tx: FinanceLedgerRow[];
  selected: Set<string>;
  setSelected: (next: Set<string>) => void;
}) {
  const groups = useMemo(() => recurringGroups(tx), [tx]);
  if (groups.length === 0) return null;

  function toggleGroup(g: RepeatGroup, allSelected: boolean) {
    const next = new Set(selected);
    g.ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
    setSelected(next);
  }

  return (
    <section className="mb-4 rounded-xl border border-base-700 bg-base-900 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-ink-50">Repeated payments, select together</h3>
          <p className="mt-1 max-w-xl text-[11px] text-ink-500">
            Same description across different dates. Click Select matching to tick every matching unallocated
            payment, including other pages. Always verify these are the same type of payment before assigning a cost
            head.
          </p>
        </div>
        <span className="rounded-full border border-base-700 px-2 py-0.5 text-[11px] font-medium text-ink-500">
          {groups.length} frequent payees shown
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {groups.map((g) => {
          const allSelected = g.ids.every((id) => selected.has(id));
          return (
            <div
              key={g.key}
              className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 ${
                allSelected ? "border-status-active/50 bg-status-active/10" : "border-base-700"
              }`}
            >
              <div className="min-w-0">
                <strong className="block truncate text-xs text-ink-50" title={g.label}>
                  {g.label}
                </strong>
                <small className="text-[11px] text-ink-500">
                  {g.count} payments · {usd(g.amount)}
                </small>
              </div>
              <button
                onClick={() => toggleGroup(g, allSelected)}
                className={`shrink-0 rounded-lg border px-2 py-1 text-[11px] ${
                  allSelected
                    ? "border-status-active/50 bg-status-active/15 text-status-active"
                    : "border-base-700 text-ink-300 hover:text-ink-50"
                }`}
              >
                {allSelected ? "Remove" : "Select matching"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
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
  transactions: allTransactions,
  departments,
  managementCostHeads,
  costHeads,
}: {
  transactions: FinanceLedgerRow[];
  departments: string[];
  managementCostHeads: string[];
  costHeads: FinanceState["costHeads"];
}) {
  // Scoped by the global Finance filter bar — reviewPage() in the source
  // app resolves its rows via txSelection(), which calls filt() first.
  const transactions = useFilteredFinanceRows(allTransactions);
  const [rows, setRows] = useState(transactions);
  useEffect(() => {
    setRows(transactions);
  }, [transactions]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageIds, setPageIds] = useState<string[]>([]);
  const [classifyTarget, setClassifyTarget] = useState<FinanceLedgerRow | null>(null);

  const tx = useMemo(() => rows.filter((t) => !t.managementDepartment || !t.managementCostHead), [rows]);
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

      <ReviewRepeatGroups tx={tx} selected={selected} setSelected={setSelected} />

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
