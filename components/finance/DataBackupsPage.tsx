"use client";

import { useState } from "react";
import { DatabaseBackup, Download, UploadCloud, AlertTriangle, Sparkles } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import type { FinanceState } from "@/lib/finance/ledgerData";

// Direct structural port of the source app's "Local SQL database and
// management settings" screen. This port stores the ledger and every
// classification in the shared Sphaera (Azure SQL) database rather than a
// local SQLite file, so the copy below is adapted accordingly while
// keeping the original's spirit. Backup export/restore were never part of
// the Stage 3/4 backend port (see app/api/finance/{backup,restore}/
// route.ts) — both stay honest 501s here. The source's whole "Developer
// and AI integration" OpenAI-key panel is dropped: this port's chat
// assistant is Sphaera's own Janus, not a user-supplied API key.

function usd(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <h4 className="text-[11px] text-ink-500">{title}</h4>
      <div className="mt-1 text-xl font-semibold text-ink-50">{value}</div>
    </div>
  );
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function downloadBlob(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function DataBackupsPage({
  state,
  importedFilesCount,
}: {
  state: FinanceState;
  importedFilesCount: number;
}) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreOk, setRestoreOk] = useState(false);

  const [editingMonth, setEditingMonth] = useState<string | null>(null);
  const [draftBudget, setDraftBudget] = useState("");
  const [savingMonth, setSavingMonth] = useState(false);
  const [monthError, setMonthError] = useState<string | null>(null);
  const [monthOverrides, setMonthOverrides] = useState<Record<string, number>>({});

  async function handleDownloadBackup() {
    setDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch("/api/finance/backup");
      const data = await res.json().catch(() => null);
      if (res.status === 501) {
        setDownloadError(data?.error ?? "Finance backup export is not yet implemented");
        return;
      }
      if (!res.ok) throw new Error(data?.error ?? "Failed to download backup");
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Failed");
    } finally {
      setDownloading(false);
    }
  }

  function handleExportCsv() {
    const header = ["Month", "Date", "Description", "Amount USD", "Department", "Cost head", "Debt period"];
    const lines = [header.join(",")];
    for (const t of state.transactions) {
      lines.push(
        [
          t.month,
          new Date(t.date).toISOString().slice(0, 10),
          csvEscape(t.description ?? ""),
          t.amount.toFixed(2),
          csvEscape(t.managementDepartment ?? ""),
          csvEscape(t.managementCostHead ?? ""),
          t.debtPeriod,
        ].join(",")
      );
    }
    downloadBlob(`finance-payments-${new Date().toISOString().slice(0, 10)}.csv`, lines.join("\n"), "text/csv");
  }

  async function handleRestore(e: React.FormEvent) {
    e.preventDefault();
    if (!restoreFile) {
      setRestoreError("Select a backup file first");
      return;
    }
    setRestoring(true);
    setRestoreError(null);
    setRestoreOk(false);
    try {
      const formData = new FormData();
      formData.append("file", restoreFile);
      const res = await fetch("/api/finance/restore", { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (res.status === 501) {
        setRestoreError(data?.error ?? "Finance restore is not yet implemented");
        return;
      }
      if (!res.ok) throw new Error(data?.error ?? "Failed to restore backup");
      setRestoreOk(true);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Failed");
    } finally {
      setRestoring(false);
    }
  }

  function startEdit(month: string, current: number) {
    setEditingMonth(month);
    setDraftBudget(current ? String(current) : "");
    setMonthError(null);
  }

  async function saveEdit(month: string) {
    const value = Number(draftBudget);
    if (!Number.isFinite(value) || value < 0) {
      setMonthError("Enter a valid budget amount");
      return;
    }
    setSavingMonth(true);
    setMonthError(null);
    try {
      const res = await fetch("/api/finance/monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, opexBudget: value }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to save budget");
      setMonthOverrides((prev) => ({ ...prev, [month]: value }));
      setEditingMonth(null);
    } catch (err) {
      setMonthError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSavingMonth(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-50">Local SQL database and management settings</h1>
        <p className="mt-1 text-sm text-ink-500">
          The source ledger and every classification are stored in the shared Sphaera database, not just in your
          browser.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Ledger payments" value={state.transactions.length.toLocaleString()} />
        <Kpi title="Saved classifications" value={state.classifications.toLocaleString()} />
        <Kpi title="Imported files" value={importedFilesCount.toLocaleString()} />
        <Kpi title="Original Finance account choices" value={state.costHeads.length.toLocaleString()} />
      </div>

      <div className="mt-4">
        <WidgetCard title="Backup and migration" icon={DatabaseBackup}>
          <p className="text-xs text-ink-500">
            Download a complete backup of the ledger, classifications and settings before making bulk changes, or to
            migrate the data elsewhere. Backup export and restore are Payroll-gated because a full backup includes
            People Costs data.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={handleDownloadBackup}
              disabled={downloading}
              className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
              {downloading ? "Requesting..." : "Download SQL database backup (.json)"}
            </button>
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 rounded-lg border border-base-700 px-3 py-2 text-xs font-medium text-ink-300 hover:bg-base-700"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
              Export filtered payments (.csv)
            </button>
          </div>

          {downloadError && (
            <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-status-alert/30 bg-status-alert/10 p-3">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-alert" strokeWidth={1.75} />
              <div>
                <p className="text-xs font-medium text-status-alert">Not yet implemented</p>
                <p className="mt-1 text-[11px] text-ink-300">{downloadError}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleRestore} className="mt-4 space-y-2.5 border-t border-base-800 pt-4">
            <p className="text-xs text-ink-500">Restore a previously downloaded backup file.</p>
            <input
              type="file"
              onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none file:mr-3 file:rounded-md file:border-0 file:bg-base-700 file:px-2 file:py-1 file:text-ink-50"
            />
            <button
              type="submit"
              disabled={restoring}
              className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
            >
              <UploadCloud className="h-3.5 w-3.5" strokeWidth={1.75} />
              {restoring ? "Restoring..." : "Restore backup"}
            </button>
          </form>
          {restoreOk && <p className="mt-2 text-xs text-status-active">Restore completed.</p>}
          {restoreError && (
            <div className="mt-3 flex items-start gap-1.5 rounded-lg border border-status-alert/30 bg-status-alert/10 p-3">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-alert" strokeWidth={1.75} />
              <div>
                <p className="text-xs font-medium text-status-alert">Not yet implemented</p>
                <p className="mt-1 text-[11px] text-ink-300">{restoreError}</p>
              </div>
            </div>
          )}

          <p className="mt-4 text-[11px] text-ink-600">
            A full SQL backup restore replaces the current database. A backup exported from the original standalone
            dashboard transfers the saved payment classifications only, without replacing the transactions already in
            SQL.
          </p>
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard title="Monthly budget and collection figures">
          <p className="text-xs text-ink-500">
            New months are imported automatically as part of the ledger. Budgets and collections only import
            automatically from a compatible tab in that same file; otherwise they must be entered here manually.
          </p>

          <div className="mt-3 overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Month</th>
                  <th className="px-3 py-2">Operating budget</th>
                  <th className="px-3 py-2">Collections</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {state.monthly.map((m) => {
                  const effectiveBudget = monthOverrides[m.month] ?? m.opexBudget;
                  const missing = !effectiveBudget;
                  return (
                    <tr key={m.month} className="border-b border-base-800 text-ink-300 last:border-0">
                      <td className="px-3 py-2 text-ink-50">{m.month}</td>
                      <td className="px-3 py-2">
                        {editingMonth === m.month ? (
                          <div className="flex items-center gap-2">
                            <input
                              value={draftBudget}
                              onChange={(e) => setDraftBudget(e.target.value)}
                              type="number"
                              className="w-28 rounded-lg border border-base-700 bg-base-800 px-2 py-1 text-xs text-ink-50 outline-none"
                            />
                            <button
                              onClick={() => saveEdit(m.month)}
                              disabled={savingMonth}
                              className="rounded-md bg-ink-50 px-2 py-1 text-[11px] font-medium text-base-950 hover:bg-white disabled:opacity-50"
                            >
                              {savingMonth ? "Saving..." : "Save"}
                            </button>
                            <button
                              onClick={() => setEditingMonth(null)}
                              className="rounded-md border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:bg-base-700"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : missing ? (
                          <span className="rounded-full bg-status-alert/15 px-2 py-0.5 text-[11px] font-medium text-status-alert">
                            Budget missing
                          </span>
                        ) : (
                          usd(effectiveBudget)
                        )}
                      </td>
                      <td className="px-3 py-2">{usd(m.collections)}</td>
                      <td className="px-3 py-2 text-right">
                        {editingMonth !== m.month && (
                          <button
                            onClick={() => startEdit(m.month, effectiveBudget)}
                            className="rounded-md border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:bg-base-700"
                          >
                            Edit data
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {state.monthly.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-ink-500">
                      No months recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {monthError && <p className="mt-2 text-xs text-status-inactive">{monthError}</p>}
        </WidgetCard>
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-ink-600">
        <Sparkles className="h-3 w-3" strokeWidth={1.75} />
        Finance&apos;s chat assistant (Ask Your Data) is powered by Sphaera&apos;s own Janus. No API key or
        configuration is needed.
      </p>
    </div>
  );
}
