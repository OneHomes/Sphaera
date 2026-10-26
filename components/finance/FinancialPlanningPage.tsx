"use client";

import { useMemo, useState } from "react";
import {
  FileClock,
  PieChart,
  UploadCloud,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

type PlanRow = {
  id: string;
  fyStart: number;
  version: number;
  name: string | null;
  status: string;
  createdAt: string | Date;
  approvedAt: string | Date | null;
};
type PlanLineRow = { id: string; planId: string; month: string; department: string; costHead: string; budgetUsd: number };
type PlanTargetRow = { id: string; planId: string; month: string; salesTargetUsd: number; collectionsTargetUsd: number };

type BudgetRowDraft = { department: string; costHead: string; annualBudgetUsd: string };

type PreviewIssue = { row: number; error: string; month?: string | null; department?: string; costHead?: string };
type PreviewResult = {
  ok: true;
  token: string;
  year: number;
  fy: string;
  filename: string;
  format: string;
  valid: number;
  targets: number;
  emptySkipped: number;
  invalid: number;
  issues: PreviewIssue[];
  totalUsd: number;
  sample: { month: string; department: string; costHead: string; budgetUsd: number }[];
  ready: boolean;
  note?: string;
};

function fyName(fyStart: number): string {
  return `FY${fyStart}/${String((fyStart + 1) % 100).padStart(2, "0")}`;
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatDate(value: string | Date | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-base-700 bg-base-800 p-3">
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink-50">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style = status === "Approved" ? "bg-status-active/15 text-status-active" : "bg-status-alert/15 text-status-alert";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${style}`}>{status}</span>;
}

const inputClass =
  "w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500";

export function FinancialPlanningPage({
  plans: initialPlans,
  lines: initialLines,
  targets: initialTargets,
  departments,
  costHeads,
}: {
  plans: PlanRow[];
  lines: PlanLineRow[];
  targets: PlanTargetRow[];
  departments: string[];
  costHeads: string[];
}) {
  const [plans, setPlans] = useState<PlanRow[]>(initialPlans);
  const [lines, setLines] = useState<PlanLineRow[]>(initialLines);
  const [targets, setTargets] = useState<PlanTargetRow[]>(initialTargets);
  const [reloading, setReloading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  async function reload() {
    setReloading(true);
    try {
      const res = await fetch("/api/finance/plans");
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans ?? []);
        setLines(data.lines ?? []);
        setTargets(data.targets ?? []);
      }
    } finally {
      setReloading(false);
    }
  }

  const planTotals = useMemo(() => {
    const totals = new Map<string, { budget: number; collections: number }>();
    for (const l of lines) {
      const cur = totals.get(l.planId) ?? { budget: 0, collections: 0 };
      cur.budget += l.budgetUsd;
      totals.set(l.planId, cur);
    }
    for (const t of targets) {
      const cur = totals.get(t.planId) ?? { budget: 0, collections: 0 };
      cur.collections += t.collectionsTargetUsd;
      totals.set(t.planId, cur);
    }
    return totals;
  }, [lines, targets]);

  const approvedCount = plans.filter((p) => p.status === "Approved").length;
  const latestPlan = plans[0];

  async function handleApprove(id: string) {
    setApprovingId(id);
    try {
      const res = await fetch("/api/finance/plans/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error ?? "Failed to approve plan");
        return;
      }
      await reload();
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Financial Planning</h1>
          <p className="mt-1 text-sm text-ink-500">
            Annual budgets run November to October. {plans.length.toLocaleString()} plan version
            {plans.length === 1 ? "" : "s"} recorded.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <WidgetCard title="Plan Versions" icon={FileClock}>
          <Tile label="Total recorded" value={plans.length.toLocaleString()} />
        </WidgetCard>
        <WidgetCard title="Approved Years" icon={CheckCircle2}>
          <Tile label="Locked plans" value={approvedCount.toLocaleString()} />
        </WidgetCard>
        <WidgetCard title="Latest Plan" icon={PieChart}>
          {latestPlan ? (
            <Tile
              label={`${fyName(latestPlan.fyStart)} v${latestPlan.version}`}
              value={formatUsd(planTotals.get(latestPlan.id)?.budget ?? 0)}
            />
          ) : (
            <p className="text-xs text-ink-500">No plans yet.</p>
          )}
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard title="Financial Plans" icon={FileClock}>
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Fiscal Year</th>
                  <th className="px-3 py-2">Version</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Annual Budget</th>
                  <th className="px-3 py-2">Collections Target</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Approved</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => {
                  const totals = planTotals.get(p.id) ?? { budget: 0, collections: 0 };
                  return (
                    <tr key={p.id} className="border-b border-base-800 text-ink-300 last:border-0">
                      <td className="px-3 py-2 text-ink-50">{fyName(p.fyStart)}</td>
                      <td className="px-3 py-2">v{p.version}</td>
                      <td className="px-3 py-2">{p.name ?? "—"}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-3 py-2">{formatUsd(totals.budget)}</td>
                      <td className="px-3 py-2">{formatUsd(totals.collections)}</td>
                      <td className="px-3 py-2">{formatDate(p.createdAt)}</td>
                      <td className="px-3 py-2">{formatDate(p.approvedAt)}</td>
                      <td className="px-3 py-2 text-right">
                        {p.status !== "Approved" && (
                          <button
                            onClick={() => handleApprove(p.id)}
                            disabled={approvingId === p.id}
                            className="rounded-lg border border-base-700 px-2 py-1 text-[11px] font-medium text-ink-300 hover:bg-base-800 disabled:opacity-50"
                          >
                            {approvingId === p.id ? "Approving…" : "Approve"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {plans.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-ink-500">
                      No financial plans yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {reloading && <p className="mt-2 text-[11px] text-ink-500">Refreshing…</p>}
        </WidgetCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CreateApprovedYearForm departments={departments} costHeads={costHeads} onCreated={reload} />
        <UploadPlanForm onCommitted={reload} />
      </div>
    </div>
  );
}

function CreateApprovedYearForm({
  departments,
  costHeads,
  onCreated,
}: {
  departments: string[];
  costHeads: string[];
  onCreated: () => void;
}) {
  const nextYear = new Date().getUTCFullYear();
  const [year, setYear] = useState(String(nextYear));
  const [name, setName] = useState("");
  const [revisionReason, setRevisionReason] = useState("");
  const [annualCollectionsUsd, setAnnualCollectionsUsd] = useState("");
  const [annualSalesUsd, setAnnualSalesUsd] = useState("");
  const [rows, setRows] = useState<BudgetRowDraft[]>([
    { department: departments[0] ?? "", costHead: costHeads[0] ?? "", annualBudgetUsd: "" },
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function updateRow(i: number, patch: Partial<BudgetRowDraft>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { department: departments[0] ?? "", costHead: costHeads[0] ?? "", annualBudgetUsd: "" }]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/finance/plans/create-year", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: Number(year),
          name: name || undefined,
          revisionReason: revisionReason || undefined,
          confirmLock: true,
          annualCollectionsUsd: annualCollectionsUsd === "" ? undefined : Number(annualCollectionsUsd),
          annualSalesUsd: annualSalesUsd === "" ? undefined : Number(annualSalesUsd),
          budgets: rows
            .filter((r) => r.department && r.costHead && r.annualBudgetUsd !== "")
            .map((r) => ({
              department: r.department,
              costHead: r.costHead,
              annualBudgetUsd: Number(r.annualBudgetUsd),
            })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to create plan");
      }
      setSuccess(`${data.fy} approved with ${data.heads} budget lines, ${formatUsd(data.spendingBudgetUsd)} total.`);
      setRows([{ department: departments[0] ?? "", costHead: costHeads[0] ?? "", annualBudgetUsd: "" }]);
      setRevisionReason("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <WidgetCard title="Create Approved Year" icon={CheckCircle2}>
      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div className="flex gap-2">
          <input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="Fiscal year, e.g. 2027"
            type="number"
            className={inputClass}
          />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Plan name (optional)" className={inputClass} />
        </div>
        <div className="flex gap-2">
          <input
            value={annualCollectionsUsd}
            onChange={(e) => setAnnualCollectionsUsd(e.target.value)}
            placeholder="Annual collections target USD"
            type="number"
            className={inputClass}
          />
          <input
            value={annualSalesUsd}
            onChange={(e) => setAnnualSalesUsd(e.target.value)}
            placeholder="Annual sales target USD (optional)"
            type="number"
            className={inputClass}
          />
        </div>
        <input
          value={revisionReason}
          onChange={(e) => setRevisionReason(e.target.value)}
          placeholder="Revision reason (required if this FY already has an approved plan)"
          className={inputClass}
        />

        <div className="space-y-2 rounded-lg border border-base-700 bg-base-800/40 p-2.5">
          <p className="text-[11px] font-medium text-ink-500">Department / Cost Head Budgets</p>
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <select
                value={row.department}
                onChange={(e) => updateRow(i, { department: e.target.value })}
                className={inputClass}
              >
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                value={row.costHead}
                onChange={(e) => updateRow(i, { costHead: e.target.value })}
                className={inputClass}
              >
                {costHeads.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                value={row.annualBudgetUsd}
                onChange={(e) => updateRow(i, { annualBudgetUsd: e.target.value })}
                placeholder="Annual USD"
                type="number"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={rows.length === 1}
                className="shrink-0 rounded-lg border border-base-700 p-2 text-ink-500 hover:text-status-inactive disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1 rounded-lg border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:bg-base-800"
          >
            <Plus className="h-3 w-3" strokeWidth={1.75} /> Add line
          </button>
        </div>

        {error && <p className="text-xs text-status-inactive">{error}</p>}
        {success && <p className="text-xs text-status-active">{success}</p>}
        <button
          type="submit"
          disabled={isSaving || !year}
          className="w-full rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
        >
          {isSaving ? "Creating…" : "Create & approve year"}
        </button>
      </form>
    </WidgetCard>
  );
}

function UploadPlanForm({ onCommitted }: { onCommitted: () => void }) {
  const nextYear = new Date().getUTCFullYear();
  const [fy, setFy] = useState(String(nextYear));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{ id: string; fy: string; version: number } | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    if (!file || isPreviewing) return;
    setIsPreviewing(true);
    setPreviewError(null);
    setPreview(null);
    setCommitResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("fy", fy);
      const res = await fetch("/api/finance/plans/preview", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Preview failed");
      setPreview(data);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleCommit() {
    if (!preview || isCommitting) return;
    setIsCommitting(true);
    setCommitError(null);
    try {
      const res = await fetch("/api/finance/plans/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: preview.token }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Commit failed");
      setCommitResult(data);
      setPreview(null);
      onCommitted();
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsCommitting(false);
    }
  }

  async function handleApproveCommitted() {
    if (!commitResult) return;
    const res = await fetch("/api/finance/plans/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: commitResult.id }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setCommitError(data?.error ?? "Approve failed");
      return;
    }
    setCommitResult(null);
    onCommitted();
  }

  return (
    <WidgetCard title="Upload & Commit a Plan" icon={UploadCloud}>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 rounded-lg border border-base-700 bg-base-800/40 p-2.5">
          <div>
            <p className="text-xs text-ink-300">Blank workbook template</p>
            <p className="text-[11px] text-ink-500">Summary + Cost Head Budgets sheets, Nov–Oct.</p>
          </div>
          <a
            href={`/api/finance/plans/template?fy=${encodeURIComponent(fy)}`}
            download
            className="flex items-center gap-1 rounded-lg border border-base-700 px-2.5 py-1.5 text-[11px] font-medium text-ink-300 hover:bg-base-800"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} /> Download
          </a>
        </div>

        <form onSubmit={handlePreview} className="space-y-2.5">
          <div className="flex gap-2">
            <input value={fy} onChange={(e) => setFy(e.target.value)} type="number" placeholder="Fiscal year" className={inputClass} />
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-1.5 text-xs text-ink-50 outline-none file:mr-2 file:rounded-md file:border-0 file:bg-base-700 file:px-2 file:py-1 file:text-ink-300"
            />
          </div>
          {previewError && <p className="text-xs text-status-inactive">{previewError}</p>}
          <button
            type="submit"
            disabled={!file || isPreviewing}
            className="w-full rounded-lg border border-base-700 py-2 text-xs font-medium text-ink-300 hover:bg-base-800 disabled:opacity-50"
          >
            {isPreviewing ? "Validating…" : "Preview upload"}
          </button>
        </form>

        {preview && (
          <div className="space-y-2 rounded-lg border border-base-700 bg-base-800/40 p-2.5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile label="Valid rows" value={preview.valid.toLocaleString()} />
              <Tile label="Invalid rows" value={preview.invalid.toLocaleString()} />
              <Tile label="Total" value={formatUsd(preview.totalUsd)} />
              <Tile label="Format" value={preview.format} />
            </div>
            {preview.issues.length > 0 && (
              <div className="rounded-lg border border-status-alert/40 bg-status-alert/10 p-2 text-[11px] text-status-alert">
                <div className="mb-1 flex items-center gap-1 font-medium">
                  <AlertTriangle className="h-3 w-3" strokeWidth={1.75} /> {preview.issues.length} issue(s)
                </div>
                <ul className="max-h-28 space-y-0.5 overflow-y-auto">
                  {preview.issues.slice(0, 10).map((issue, i) => (
                    <li key={i}>
                      Row {issue.row}: {issue.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {commitError && <p className="text-xs text-status-inactive">{commitError}</p>}
            <button
              onClick={handleCommit}
              disabled={!preview.ready || isCommitting}
              className="w-full rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
            >
              {isCommitting ? "Committing…" : preview.ready ? "Commit as Draft" : "Fix issues before committing"}
            </button>
          </div>
        )}

        {commitResult && (
          <div className="flex items-center justify-between rounded-lg border border-status-active/40 bg-status-active/10 p-2.5 text-xs text-status-active">
            <span>
              {commitResult.fy} v{commitResult.version} committed as Draft.
            </span>
            <button onClick={handleApproveCommitted} className="rounded-lg border border-status-active/40 px-2 py-1 text-[11px] font-medium hover:bg-status-active/20">
              Approve now
            </button>
          </div>
        )}
      </div>
    </WidgetCard>
  );
}
