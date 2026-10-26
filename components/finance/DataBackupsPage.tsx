"use client";

import { useState } from "react";
import { DatabaseBackup, Download, UploadCloud, AlertTriangle } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

export function DataBackupsPage() {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreOk, setRestoreOk] = useState(false);

  async function handleDownload() {
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

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Data &amp; Backups</h1>
          <p className="mt-1 text-sm text-ink-500">Download or restore a full Finance data backup</p>
        </div>
      </div>

      <div className="rounded-xl border border-status-alert/30 bg-status-alert/5 p-3.5">
        <p className="flex items-center gap-1.5 text-xs font-medium text-status-alert">
          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} />
          Known backend gap
        </p>
        <p className="mt-1 text-[11px] text-ink-300">
          Backup export and restore were not part of the Stage 3/4 backend port. The buttons below call real,
          payroll-gated API routes, but those routes currently return &quot;not yet implemented&quot; (HTTP 501)
          rather than producing or applying a fake backup file. This is a backend gap, not a UI bug.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WidgetCard title="Download Backup" icon={Download}>
          <p className="text-xs text-ink-500">
            Exports a full snapshot of Finance data (ledger, allocations, treasury, payroll and merchant records).
          </p>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="mt-3 flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
            {downloading ? "Requesting…" : "Download backup"}
          </button>
          {downloadError && (
            <div className="mt-3 rounded-lg border border-status-alert/30 bg-status-alert/10 p-3">
              <p className="text-xs font-medium text-status-alert">Not yet implemented</p>
              <p className="mt-1 text-[11px] text-ink-300">{downloadError}</p>
            </div>
          )}
        </WidgetCard>

        <WidgetCard title="Upload &amp; Restore" icon={UploadCloud}>
          <p className="text-xs text-ink-500">
            Restores Finance data from a previously downloaded backup file. This replaces existing records — use with
            care.
          </p>
          <form onSubmit={handleRestore} className="mt-3 space-y-2.5">
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
              {restoring ? "Restoring…" : "Upload and restore"}
            </button>
          </form>
          {restoreOk && <p className="mt-2 text-xs text-status-active">Restore completed.</p>}
          {restoreError && (
            <div className="mt-3 rounded-lg border border-status-alert/30 bg-status-alert/10 p-3">
              <p className="text-xs font-medium text-status-alert">Not yet implemented</p>
              <p className="mt-1 text-[11px] text-ink-300">{restoreError}</p>
            </div>
          )}
        </WidgetCard>
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-ink-600">
        <DatabaseBackup className="h-3 w-3" strokeWidth={1.75} />
        Backup and restore are Payroll-gated because a full Finance backup includes People Costs data.
      </p>
    </div>
  );
}
