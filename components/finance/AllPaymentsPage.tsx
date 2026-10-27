"use client";

import { useEffect, useMemo, useState } from "react";
import type { FinanceLedgerRow, FinanceState } from "@/lib/finance/ledgerData";
import { ClassifyModal } from "./ClassifyModal";
import { DisputeModal } from "./DisputeModal";
import { PaymentsTable } from "./PaymentsTable";
import { BulkPaymentToolbar } from "./BulkPaymentToolbar";
import { useFilteredFinanceRows } from "./FinanceFilterContext";

// Direct structural/content port of the source app's paymentPage()
// (index.html line 1039) — same "Show" filter, same drilldown chip, same
// CSV export action, same 4 KPI cards (computed off the currently
// filtered/visible set, not the whole ledger), same bulk-reclassify
// toolbar, same "link selected payments to a subscription" action bar,
// same shared payments table. Only the visual implementation changes.

type ShowMode = "all" | "operating" | "debt" | "unidentified" | "review" | "nonoperating";

const SHOW_OPTIONS: { value: ShowMode; label: string }[] = [
  { value: "all", label: "Every payment" },
  { value: "operating", label: "Current operating" },
  { value: "debt", label: "Historical debt" },
  { value: "unidentified", label: "Unclassified only" },
  { value: "review", label: "Accounting reviews" },
  { value: "nonoperating", label: "Non-operating" },
];

function usd(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (compact && Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `${value < 0 ? "-" : ""}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

function Kpi({ title, value, detail, color }: { title: string; value: string; detail: string; color?: "purple" }) {
  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <h4 className="text-[11px] text-ink-500">{title}</h4>
      <div className={`mt-1 text-xl font-semibold ${color === "purple" ? "text-[#7965bd]" : "text-ink-50"}`}>
        {value}
      </div>
      <div className="mt-1 text-[11px] text-ink-500">{detail}</div>
    </div>
  );
}

function exportCsv(rows: FinanceLedgerRow[]) {
  const header = ["Date", "Description", "Department", "Cost head", "Amount USD", "Debt period"];
  const lines = rows.map((r) =>
    [
      new Date(r.date).toISOString().slice(0, 10),
      r.description,
      r.managementDepartment ?? "Unclassified",
      r.managementCostHead ?? "",
      String(r.amount),
      r.debtPeriod,
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "payments.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function AllPaymentsPage({
  transactions: allTransactions,
  departments,
  managementCostHeads,
  costHeads,
  initialDepartmentFilter,
  initialMonthFilter,
  initialMode,
}: {
  transactions: FinanceLedgerRow[];
  departments: string[];
  managementCostHeads: string[];
  costHeads: FinanceState["costHeads"];
  initialDepartmentFilter?: string | null;
  initialMonthFilter?: string | null;
  initialMode?: string | null;
}) {
  // Scoped by the global Finance filter bar — paymentPage() in the source
  // app resolves its rows via txSelection(), which calls filt() first.
  const transactions = useFilteredFinanceRows(allTransactions);
  const [rows, setRows] = useState(transactions);
  useEffect(() => {
    setRows(transactions);
  }, [transactions]);
  const [mode, setMode] = useState<ShowMode>(
    (["all", "operating", "debt", "unidentified", "review", "nonoperating"] as const).find((m) => m === initialMode) ?? "all"
  );
  const [drillDepartment, setDrillDepartment] = useState<string | null>(initialDepartmentFilter ?? null);
  const [drillMonth, setDrillMonth] = useState<string | null>(initialMonthFilter ?? null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageIds, setPageIds] = useState<string[]>([]);
  const [classifyTarget, setClassifyTarget] = useState<FinanceLedgerRow | null>(null);
  const [disputeTarget, setDisputeTarget] = useState<FinanceLedgerRow | null>(null);
  const [showLinkBar, setShowLinkBar] = useState(false);
  const [subscriptionId, setSubscriptionId] = useState("");
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const activeDepartments = useMemo(() => new Set(departments), [departments]);
  const isOperating = (t: FinanceLedgerRow) =>
    Boolean(t.managementDepartment) && activeDepartments.has(t.managementDepartment!) && t.debtPeriod === "current";
  const isUnidentified = (t: FinanceLedgerRow) => !t.managementDepartment;

  const t = useMemo(() => {
    let out = rows;
    if (mode === "operating") out = out.filter(isOperating);
    if (mode === "debt") out = out.filter((x) => x.debtPeriod !== "current");
    if (mode === "unidentified") out = out.filter(isUnidentified);
    if (mode === "review") out = out.filter((x) => x.reviewGroup === "Accounting review");
    if (mode === "nonoperating") out = out.filter((x) => !isOperating(x));
    if (drillDepartment) out = out.filter((x) => x.managementDepartment === drillDepartment);
    if (drillMonth) out = out.filter((x) => x.month === drillMonth);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, mode, drillDepartment, drillMonth]);

  async function handleLinkSubmit() {
    if (isLinking || !subscriptionId.trim() || selected.size === 0) return;
    setIsLinking(true);
    setLinkError(null);
    try {
      const res = await fetch("/api/finance/trace/bulk-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), subscriptionId: subscriptionId.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to link payments to subscription");
      setRows((prev) =>
        prev.map((r) => (selected.has(r.id) ? { ...r, subscriptionId: subscriptionId.trim() } : r))
      );
      setSelected(new Set());
      setSubscriptionId("");
      setShowLinkBar(false);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Failed to link payments");
    } finally {
      setIsLinking(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-50">Individual payments, one click to inspect</h1>
        <p className="mt-1 text-sm text-ink-500">
          Review costs, mark prior-year debt, allocate missing cost heads and preserve an audit trail.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-ink-500">
          Show
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ShowMode)}
            className="rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs text-ink-50 outline-none"
          >
            {SHOW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {(drillDepartment || drillMonth) && (
          <button
            onClick={() => {
              setDrillDepartment(null);
              setDrillMonth(null);
            }}
            className="rounded-full border border-base-700 px-3 py-1 text-xs text-ink-300 hover:text-ink-50"
          >
            Drilldown: {[drillMonth, drillDepartment].filter(Boolean).join(" · ")} ×
          </button>
        )}
        <button
          onClick={() => exportCsv(t)}
          className="rounded-lg border border-base-700 px-3 py-1.5 text-xs text-ink-300 hover:text-ink-50"
        >
          Export payments CSV
        </button>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Selected payments" value={String(t.length)} detail="Visible transaction count" />
        <Kpi title="Total selected movements" value={usd(t.reduce((s, x) => s + x.amount, 0), true)} detail="All selected transaction values" />
        <Kpi
          title="Historical debt included"
          value={usd(t.filter((x) => x.debtPeriod !== "current").reduce((s, x) => s + x.amount, 0), true)}
          detail="Prior-year payments within selection"
          color="purple"
        />
        <Kpi title="Cost heads unresolved" value={String(t.filter(isUnidentified).length)} detail="Click a row to classify" />
      </div>

      <BulkPaymentToolbar
        mode="payments"
        tx={t}
        pageIds={pageIds}
        selected={selected}
        setSelected={setSelected}
        departments={departments}
        managementCostHeads={managementCostHeads}
        onApplied={(ids, department, costHead) => {
          setRows((prev) =>
            prev.map((r) => (ids.includes(r.id) ? { ...r, managementDepartment: department, managementCostHead: costHead } : r))
          );
          setSelected(new Set());
        }}
      />

      <div className="mb-4 rounded-xl border border-base-700 bg-base-900 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink-500">Keep subscription-linked payments grouped for automatic reconciliation.</p>
          <button
            onClick={() => setShowLinkBar((v) => !v)}
            disabled={selected.size === 0}
            className="rounded-lg bg-status-active/15 px-3 py-1.5 text-xs font-medium text-status-active disabled:opacity-40"
          >
            Link {selected.size} selected payments to a subscription
          </button>
        </div>
        {showLinkBar && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={subscriptionId}
              onChange={(e) => setSubscriptionId(e.target.value)}
              placeholder="Subscription ID"
              className="rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs text-ink-50 outline-none placeholder:text-ink-500"
            />
            <button
              onClick={handleLinkSubmit}
              disabled={isLinking || !subscriptionId.trim()}
              className="rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
            >
              {isLinking ? "Linking…" : "Confirm link"}
            </button>
            {linkError && <span className="text-[11px] text-status-inactive">{linkError}</span>}
          </div>
        )}
      </div>

      <PaymentsTable
        rows={t}
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
        onDispute={(row) => setDisputeTarget(row)}
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
                  ? { ...r, dispute: { status: updated.status, reason: updated.reason, financeOwner: updated.financeOwner } }
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
