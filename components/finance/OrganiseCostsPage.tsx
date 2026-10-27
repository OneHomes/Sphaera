"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { FinanceState } from "@/lib/finance/ledgerData";

// Direct structural/content port of the source app's organisePage()
// (index.html line 1057) — the largest screen in the source. Same 4 KPI
// cards, same Manage Departments panel, same 4-column department spend
// grid, same "Create a cost head" panel with its exact educational copy
// and the two external chart-of-accounts links, same "How the
// reorganisation works" explainer, same "Merge & retire a cost head"
// preview/confirm workflow, and the same bulk source-label-reassignment
// table, including department rename and "select all visible" wiring.

const COST_GROUPS: [string, string[]][] = [
  [
    "Marketing & Brand",
    [
      "Paid Marketing",
      "Advertising",
      "Public Relations & Media",
      "Branding & Design",
      "Content, Video & Photography",
      "CGI & Animation",
      "Lead Generation & Market Research",
      "Printing & Promotional Materials",
    ],
  ],
  [
    "Events & Commercial",
    ["Events & Exhibitions", "Venue & Event Hire", "Event Production & Materials", "Meals & Entertainment", "Business Development"],
  ],
  [
    "People & Sales",
    [
      "Salaries",
      "Commissions",
      "Agency & Referral Fees",
      "Bonuses & Incentives",
      "Employer Payroll Taxes",
      "Staff Benefits & Pensions",
      "Recruitment",
      "Training & Development",
      "Travel & Accommodation",
      "Reimbursements",
    ],
  ],
  [
    "Office, Technology & Facilities",
    [
      "Rent & Facilities",
      "Utilities & Maintenance",
      "Telephone & Internet",
      "Office Administration",
      "Software & Subscriptions",
      "IT & Equipment",
      "Security",
      "Vehicle & Transport",
      "Postage & Couriers",
    ],
  ],
  [
    "Professional & Administration",
    ["Professional & Legal Fees", "Contractors & Consultants", "Bank & Merchant Charges", "Insurance", "Licences & Permits", "Donations & CSR"],
  ],
  ["Development & Delivery", ["Project Delivery", "Site Surveys & Technical Design", "Planning & Building Permits"]],
];

const inputClass =
  "w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500";

function usd(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (compact && Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `${value < 0 ? "-" : ""}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

function Kpi({ title, value, detail, color, href }: { title: string; value: string; detail: string; color?: "amber"; href?: string }) {
  const content = (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4 transition hover:border-base-600">
      <h4 className="text-[11px] text-ink-500">{title}</h4>
      <div className={`mt-1 text-xl font-semibold ${color === "amber" ? "text-status-alert" : "text-ink-50"}`}>{value}</div>
      <div className="mt-1 text-[11px] text-ink-500">{detail}</div>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone?: "amber" | "green" }) {
  const cls =
    tone === "amber"
      ? "bg-status-alert/15 text-status-alert"
      : tone === "green"
        ? "bg-status-active/15 text-status-active"
        : "border border-base-700 text-ink-500";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

function AddNameForm({
  placeholder,
  endpoint,
  onAdded,
  submitLabel = "+ Add",
  savingLabel = "Adding…",
}: {
  placeholder: string;
  endpoint: string;
  onAdded: (name: string) => void;
  submitLabel?: string;
  savingLabel?: string;
}) {
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving || !name.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to create");
      onAdded(data?.name ?? name.trim());
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} className={inputClass} maxLength={70} />
        <button
          type="submit"
          disabled={isSaving || !name.trim()}
          className="shrink-0 rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
        >
          {isSaving ? savingLabel : submitLabel}
        </button>
      </form>
      {error && <p className="mt-1.5 text-[11px] text-status-inactive">{error}</p>}
    </div>
  );
}

type SourceRow = {
  key: string;
  head: string;
  centre: string;
  count: number;
  amount: number;
  department: string | null;
  costHead: string | null;
  source: string | null;
};

export function OrganiseCostsPage({ state }: { state: FinanceState }) {
  const [departments, setDepartments] = useState(state.departments);
  const [managementCostHeads, setManagementCostHeads] = useState(state.managementCostHeads);
  const [localOverrides, setLocalOverrides] = useState<Map<string, { department: string; costHead: string }>>(new Map());
  const [mapStatus, setMapStatus] = useState<"all" | "unmapped" | "suggested" | "confirmed">("all");
  const [mapSelected, setMapSelected] = useState<Set<string>>(new Set());
  const [mapBulkDept, setMapBulkDept] = useState("");
  const [mapBulkHead, setMapBulkHead] = useState("");
  const [isApplyingMap, setIsApplyingMap] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapResult, setMapResult] = useState<string | null>(null);
  const [mergeSource, setMergeSource] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const [mergePreview, setMergePreview] = useState<{
    source: string;
    target: string;
    payments: number;
    paymentUsd: number;
    rows: Record<string, number>;
  } | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [renamingDept, setRenamingDept] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const unidentified = (t: FinanceState["transactions"][number]) => !t.managementDepartment;

  const source: SourceRow[] = useMemo(() => {
    const m = new Map<string, { head: string; centre: string; count: number; amount: number }>();
    for (const t of state.transactions) {
      const head = t.head ?? "";
      const centre = t.costCentre ?? "";
      const key = `${head}␟${centre}`;
      const existing = m.get(key);
      if (existing) {
        existing.count++;
        existing.amount += t.amount;
      } else {
        m.set(key, { head, centre, count: 1, amount: t.amount });
      }
    }
    const mapByKey = new Map(state.legacyMappings.map((x) => [`${x.legacyHead}␟${x.legacyCentre}`, x]));
    return Array.from(m.entries())
      .map(([key, v]) => {
        const override = localOverrides.get(key);
        const mapping = mapByKey.get(key);
        return {
          key,
          ...v,
          department: override?.department ?? mapping?.department ?? null,
          costHead: override?.costHead ?? mapping?.costHead ?? null,
          source: override ? "confirmed" : mapping?.source ?? null,
        };
      })
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [state.transactions, state.legacyMappings, localOverrides]);

  const unassigned = source.filter((x) => !x.department);
  const pending = source.filter((x) => x.source === "suggested");
  const confirmed = source.filter((x) => x.source === "confirmed");

  const visibleRows = source.filter(
    (x) =>
      mapStatus === "all" ||
      (mapStatus === "unmapped" && !x.department) ||
      (mapStatus === "suggested" && x.source === "suggested") ||
      (mapStatus === "confirmed" && x.source === "confirmed")
  );
  const chosen = visibleRows.filter((x) => mapSelected.has(x.key));

  const awaitingAllocation = state.transactions.filter(unidentified);

  const spentByDept = departments.map((d) => {
    const tx = state.transactions.filter((t) => t.managementDepartment === d);
    return { key: d, total: tx.reduce((s, t) => s + t.amount, 0), count: tx.length };
  });

  function selectVisible() {
    setMapSelected(new Set(visibleRows.map((r) => r.key)));
  }
  function clearMapSelection() {
    setMapSelected(new Set());
  }
  function toggleMapRow(key: string) {
    setMapSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((r) => mapSelected.has(r.key));
  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      clearMapSelection();
    } else {
      selectVisible();
    }
  }

  function startRenameDept(d: string) {
    setRenamingDept(d);
    setRenameValue(d);
    setRenameError(null);
  }
  function cancelRenameDept() {
    setRenamingDept(null);
    setRenameValue("");
    setRenameError(null);
  }
  async function submitRenameDept() {
    if (!renamingDept || isRenaming) return;
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === renamingDept) {
      cancelRenameDept();
      return;
    }
    setIsRenaming(true);
    setRenameError(null);
    try {
      const res = await fetch("/api/finance/departments/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldName: renamingDept, newName: trimmed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to rename department");
      setDepartments((prev) => prev.map((d) => (d === renamingDept ? trimmed : d)).sort());
      cancelRenameDept();
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : "Failed to rename department");
    } finally {
      setIsRenaming(false);
    }
  }

  function previewHeadMerge() {
    if (!mergeSource || !mergeTarget || mergeSource === mergeTarget) return;
    setMergeError(null);
    const affected = state.transactions.filter((t) => t.managementCostHead === mergeSource);
    const rows: Record<string, number> = {};
    for (const t of affected) {
      const dept = t.managementDepartment || "Unassigned";
      rows[dept] = (rows[dept] ?? 0) + 1;
    }
    setMergePreview({
      source: mergeSource,
      target: mergeTarget,
      payments: affected.length,
      paymentUsd: affected.reduce((s, t) => s + t.amount, 0),
      rows,
    });
  }
  function cancelHeadMerge() {
    setMergePreview(null);
    setMergeError(null);
  }
  async function confirmHeadMerge() {
    if (!mergePreview || isMerging) return;
    setIsMerging(true);
    setMergeError(null);
    try {
      const res = await fetch("/api/finance/organise/merge-cost-head", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: mergePreview.source, target: mergePreview.target }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to merge cost heads");
      setManagementCostHeads((prev) => prev.filter((h) => h !== mergePreview.source));
      setMergePreview(null);
      setMergeSource("");
      setMergeTarget("");
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : "Failed to merge cost heads");
    } finally {
      setIsMerging(false);
    }
  }

  async function applyMappingBulk() {
    if (isApplyingMap || !mapBulkDept || !mapBulkHead || chosen.length === 0) return;
    setIsApplyingMap(true);
    setMapError(null);
    setMapResult(null);
    try {
      // No legacy-mapping-specific bulk endpoint exists in this port (the
      // source updates finance_legacy_mappings directly). Adapted here by
      // resolving every transaction matching the selected legacy
      // (head, centre) pairs and reclassifying them via the existing
      // per-payment bulk-classify endpoint instead.
      const keys = new Set(chosen.map((c) => c.key));
      const ids = state.transactions
        .filter((t) => keys.has(`${t.head ?? ""}␟${t.costCentre ?? ""}`))
        .map((t) => t.id);
      if (ids.length === 0) throw new Error("No payments matched the selected source labels.");
      const res = await fetch("/api/finance/ledger/bulk-classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, department: mapBulkDept, costHead: mapBulkHead }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to reassign source labels");
      setLocalOverrides((prev) => {
        const next = new Map(prev);
        chosen.forEach((c) => next.set(c.key, { department: mapBulkDept, costHead: mapBulkHead }));
        return next;
      });
      setMapResult(`${data.updated} payment(s) across ${chosen.length} source label(s) reassigned to ${mapBulkDept} / ${mapBulkHead}.`);
      setMapSelected(new Set());
      setMapBulkDept("");
      setMapBulkHead("");
    } catch (err) {
      setMapError(err instanceof Error ? err.message : "Failed to reassign source labels");
    } finally {
      setIsApplyingMap(false);
    }
  }

  const registeredHeads = new Set(managementCostHeads);
  const usedHeads = new Set<string>();
  const catalogueGroups = COST_GROUPS.map(([family, heads]) => {
    const valid = heads.filter((h) => registeredHeads.has(h));
    valid.forEach((h) => usedHeads.add(h));
    return { family, valid };
  });
  const extraHeads = managementCostHeads.filter((h) => !usedHeads.has(h));

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-50">Clean up the chart of costs</h1>
        <p className="mt-1 text-sm text-ink-500">
          One simple structure: Department → Cost Head → Original Payments. Your source records and debt tags are
          never changed.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Cost head choices" value={String(managementCostHeads.length)} detail="Reusable across all registered departments" />
        <Kpi title="Old source labels" value={String(source.length)} detail="Select several to merge into one cost head" />
        <Kpi
          title="Payments awaiting allocation"
          value={String(awaitingAllocation.length)}
          detail={`${usd(awaitingAllocation.reduce((s, t) => s + t.amount, 0), true)} requiring a decision`}
          color="amber"
          href="/finance/needs-allocation"
        />
        <Kpi title="Suggested mappings" value={String(pending.length)} detail="Recognisable legacy labels, not yet confirmed" />
      </div>

      <div className="mb-5 rounded-xl border border-base-700 bg-base-900 p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium text-ink-50">Manage Departments</h3>
            <p className="mt-1 max-w-xl text-[11px] text-ink-500">
              Create new departments here. They become available in payment classifications, financial-year budgets,
              invoice entries and newly exported Excel review files.
            </p>
          </div>
          <Pill>{departments.length} departments</Pill>
        </div>
        <AddNameForm
          placeholder="New department name, e.g. IT or Human Resources"
          endpoint="/api/finance/departments"
          submitLabel="+ Add department"
          onAdded={(name) => setDepartments((prev) => (prev.includes(name) ? prev : [...prev, name].sort()))}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {departments.map((d) =>
            renamingDept === d ? (
              <span key={d} className="flex items-center gap-1.5 rounded-full border border-base-600 py-1 pl-2 pr-1.5 text-[11px] text-ink-300">
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  autoFocus
                  maxLength={70}
                  className="w-32 rounded-md border border-base-700 bg-base-800 px-1.5 py-0.5 text-[11px] text-ink-50 outline-none"
                />
                <button
                  onClick={submitRenameDept}
                  disabled={isRenaming || !renameValue.trim()}
                  className="rounded-full border border-base-700 px-2 py-0.5 text-[10px] text-ink-50 hover:border-base-600 disabled:opacity-50"
                >
                  {isRenaming ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={cancelRenameDept}
                  disabled={isRenaming}
                  className="rounded-full border border-base-800 px-2 py-0.5 text-[10px] text-ink-500 hover:text-ink-50"
                >
                  Cancel
                </button>
              </span>
            ) : (
              <span key={d} className="flex items-center gap-1.5 rounded-full border border-base-700 py-1 pl-3 pr-1.5 text-[11px] text-ink-300">
                {d}
                <button
                  onClick={() => startRenameDept(d)}
                  title={`Rename ${d}`}
                  className="rounded-full border border-base-800 px-2 py-0.5 text-[10px] text-ink-300 hover:text-ink-50"
                >
                  Edit name
                </button>
              </span>
            )
          )}
        </div>
        {renameError && <p className="mt-2 text-[11px] text-status-inactive">{renameError}</p>}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {spentByDept.map((g) => (
          <Link
            key={g.key}
            href={`/finance/payments?department=${encodeURIComponent(g.key)}`}
            className="rounded-xl border border-base-700 bg-base-900 p-4 transition hover:border-base-600"
          >
            <p className="text-[10px] uppercase tracking-wide text-ink-500">Department</p>
            <h3 className="mt-1 text-sm font-medium text-ink-50">{g.key}</h3>
            <p className="mt-1 text-lg font-semibold text-ink-50">{usd(g.total, true)}</p>
            <p className="mt-1 text-[11px] text-ink-500">{g.count.toLocaleString()} allocated payments, open spending breakdown ↗</p>
          </Link>
        ))}
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-base-700 bg-base-900 p-4">
          <h3 className="text-sm font-medium text-ink-50">Create a cost head</h3>
          <p className="mt-1 text-[11px] text-ink-500">
            Add an expense type only if the existing list does not fit. Keep names short and consistent, for example{" "}
            <b className="text-ink-300">Venue &amp; Event Hire</b>, <b className="text-ink-300">Reimbursements</b> or{" "}
            <b className="text-ink-300">Paid Marketing</b>.
          </p>
          <div className="mt-3">
            <AddNameForm
              placeholder="New cost head name"
              endpoint="/api/finance/cost-heads"
              submitLabel="+ Create"
              onAdded={(name) => setManagementCostHeads((prev) => (prev.includes(name) ? prev : [...prev, name].sort()))}
            />
          </div>
          <div className="mt-3 rounded-lg border border-base-700 bg-base-800/60 p-3 text-[11px] text-ink-300">
            <b className="text-ink-300">Based on standard accounting categories</b>, personnel, selling costs,
            premises, IT, professional services and bank costs. Departments show who owns the cost, cost heads
            describe what was purchased. Refunds, asset purchases, transfers and client collections should be
            reviewed separately before inclusion in operating spending.{" "}
            <a href="https://www.xero.com/uk/glossary/chart-of-accounts/" target="_blank" rel="noopener noreferrer" className="text-ink-50 underline">
              Xero chart of accounts
            </a>{" "}
            ·{" "}
            <a
              href="https://quickbooks.intuit.com/learn-support/en-uk/help-article/chart-accounts/understanding-detail-types-quickbooks-online/L9IuTxhDc_GB_en_GB"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-50 underline"
            >
              QuickBooks expense categories
            </a>
            .
          </div>
          <div className="mt-3 space-y-3">
            {catalogueGroups.map(({ family, valid }) => (
              <div key={family}>
                <h4 className="mb-1 text-xs font-medium text-ink-50">
                  {family} <span className="text-[11px] text-ink-500">{valid.length} heads</span>
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {valid.map((h) => (
                    <span key={h} className="rounded-full border border-base-700 px-2 py-0.5 text-[11px] text-ink-300">
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {extraHeads.length > 0 && (
              <div>
                <h4 className="mb-1 text-xs font-medium text-ink-50">
                  Your additional cost heads <span className="text-[11px] text-ink-500">{extraHeads.length}</span>
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {extraHeads.map((h) => (
                    <span key={h} className="rounded-full border border-base-700 px-2 py-0.5 text-[11px] text-ink-300">
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-base-700 bg-base-900 p-4">
          <h3 className="text-sm font-medium text-ink-50">How the reorganisation works</h3>
          <p className="mt-2 text-xs text-ink-300">
            Choose legacy source labels on the left, choose their destination department and cost head, then apply.
            That single decision automatically reorganises all matching payments in every chart.
          </p>
          <p className="mt-2 text-[11px] text-ink-500">
            Need to separate some payments from the same old source head? Open{" "}
            <Link href="/finance/payments" className="text-ink-300 underline hover:text-ink-50">
              All Payments
            </Link>{" "}
            to tick individual transactions and override them in bulk, or click one payment to edit it.
          </p>
          <div className="mt-3 rounded-lg border border-status-alert/40 bg-status-alert/10 p-3 text-[11px] text-status-alert">
            Unclear items, including cash transfers, client collections, refunds and fixed assets, remain for review.
            Do not book them as operating expenses without confirmation from Finance.
          </div>
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-base-700 bg-base-900 p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium text-ink-50">Merge &amp; retire a cost head</h3>
            <p className="mt-1 max-w-xl text-[11px] text-ink-500">
              Move every allocated payment from one simplified cost head to another. Remove the old head from future
              selections without changing original ERP records or locked financial plans.
            </p>
          </div>
          <Pill tone="amber">Controlled action</Pill>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={mergeSource} onChange={(e) => setMergeSource(e.target.value)} className={`${inputClass} w-auto`}>
            <option value="">Choose old head</option>
            {managementCostHeads.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <select value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)} className={`${inputClass} w-auto`}>
            <option value="">Choose replacement</option>
            {managementCostHeads.filter((h) => h !== mergeSource).map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <button
            onClick={previewHeadMerge}
            disabled={!mergeSource || !mergeTarget || mergeSource === mergeTarget}
            className="rounded-lg border border-base-700 px-3 py-1.5 text-xs text-ink-300 hover:text-ink-50 disabled:opacity-40"
          >
            Preview transfer
          </button>
        </div>

        {mergePreview && (
          <>
            <div className="mt-3.5 rounded-lg border border-status-alert/40 bg-status-alert/10 p-3 text-[11px] text-status-alert">
              <strong className="block text-xs">Review before merging</strong>
              <div className="mt-2">
                {mergePreview.source} → <strong>{mergePreview.target}</strong>
              </div>
              <div className="mt-1">
                {mergePreview.payments.toLocaleString()} affected payments, {usd(mergePreview.paymentUsd)}. Original
                payment dates, currencies, debt classifications and bank references will be retained.
              </div>
              {Object.keys(mergePreview.rows).length > 0 && (
                <div className="mt-1.5">
                  {Object.entries(mergePreview.rows)
                    .filter(([, v]) => v)
                    .map(([k, v]) => `${k.replaceAll("_", " ")}: ${v}`)
                    .join(" · ")}
                </div>
              )}
              <div className="mt-1.5">
                Existing approved budget versions are preserved. They may still display the retired head for
                historical comparison.
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={confirmHeadMerge}
                disabled={isMerging}
                className="rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
              >
                {isMerging ? "Merging…" : "Confirm transfer & retire old head"}
              </button>
              <button
                onClick={cancelHeadMerge}
                disabled={isMerging}
                className="rounded-lg border border-base-700 px-3 py-1.5 text-xs text-ink-300 hover:text-ink-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </>
        )}
        {mergeError && <p className="mt-3 text-[11px] text-status-inactive">{mergeError}</p>}
      </div>

      <div className="rounded-xl border border-base-700 bg-base-900 p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium text-ink-50">Reassign old Finance cost heads in bulk</h3>
            <p className="mt-1 max-w-xl text-[11px] text-ink-500">
              Check several original labels and book them under one department and one simplified cost head.
              Suggested mappings have not been Finance-approved.
            </p>
          </div>
          <Pill tone={chosen.length ? "green" : undefined}>{chosen.length} selected</Pill>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            value={mapStatus}
            onChange={(e) => setMapStatus(e.target.value as typeof mapStatus)}
            className={`${inputClass} w-auto`}
          >
            <option value="all">All {source.length} source labels</option>
            <option value="unmapped">Needs decision ({unassigned.length})</option>
            <option value="suggested">Suggested ({pending.length})</option>
            <option value="confirmed">Confirmed ({confirmed.length})</option>
          </select>
          <button onClick={selectVisible} className="rounded-lg border border-base-700 px-2.5 py-1.5 text-[11px] text-ink-300 hover:text-ink-50">
            Select shown ({visibleRows.length})
          </button>
          <button
            onClick={clearMapSelection}
            disabled={mapSelected.size === 0}
            className="rounded-lg border border-base-700 px-2.5 py-1.5 text-[11px] text-ink-300 hover:text-ink-50 disabled:opacity-40"
          >
            Clear selection
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-base-700">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-base-700 bg-base-900 text-ink-500">
              <tr>
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    title="Select visible cost head labels"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    className="h-3.5 w-3.5 rounded border-base-700 bg-base-800"
                  />
                </th>
                <th className="px-3 py-2">Original Finance label</th>
                <th className="px-3 py-2">Proposed / approved destination</th>
                <th className="px-3 py-2">USD</th>
                <th className="px-3 py-2">Payments</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((x) => (
                <tr key={x.key} className="border-b border-base-800 text-ink-300 last:border-0">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={mapSelected.has(x.key)}
                      onChange={() => toggleMapRow(x.key)}
                      className="h-3.5 w-3.5 rounded border-base-700 bg-base-800"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <b className="text-ink-50">{x.centre || "—"}</b>
                    <div className="text-[11px] text-ink-500">{x.head || "—"}</div>
                  </td>
                  <td className="px-3 py-2">
                    {x.department ? (
                      <span>
                        <b className="text-ink-50">{x.department}</b> → {x.costHead}
                      </span>
                    ) : (
                      <Pill tone="amber">Needs allocation</Pill>
                    )}
                    <div className="text-[11px] text-ink-500">
                      {x.source === "confirmed" ? "Confirmed by you" : x.source === "suggested" ? "Suggested, please verify" : "Not mapped"}
                    </div>
                  </td>
                  <td className="px-3 py-2">{usd(x.amount)}</td>
                  <td className="px-3 py-2">{x.count}</td>
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-ink-500">
                    No historical labels in this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={mapBulkDept} onChange={(e) => setMapBulkDept(e.target.value)} className={`${inputClass} w-auto`}>
            <option value="">Department…</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select value={mapBulkHead} onChange={(e) => setMapBulkHead(e.target.value)} className={`${inputClass} w-auto`}>
            <option value="">Cost head…</option>
            {managementCostHeads.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            onClick={applyMappingBulk}
            disabled={isApplyingMap || !mapBulkDept || !mapBulkHead || chosen.length === 0}
            className="rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
          >
            {isApplyingMap ? "Assigning…" : `Assign ${chosen.length} source heads`}
          </button>
        </div>
        {mapError && <p className="mt-2 text-[11px] text-status-inactive">{mapError}</p>}
        {mapResult && <p className="mt-2 text-[11px] text-status-active">{mapResult}</p>}
        <p className="mt-3 text-[11px] text-ink-500">
          Reassigning a source label updates all its payments, except any payment with an individual override. A full
          history is saved in the SQL audit log.
        </p>
      </div>
    </div>
  );
}
