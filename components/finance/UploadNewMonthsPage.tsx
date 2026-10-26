"use client";

import { useState } from "react";
import { UploadCloud, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

type PreviewRow = Record<string, unknown>;

export function UploadNewMonthsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [month, setMonth] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[] | null>(null);
  const [notImplemented, setNotImplemented] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [committed, setCommitted] = useState(false);

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Select a ledger / cost-centre-detail XLSX file first");
      return;
    }
    setPreviewing(true);
    setError(null);
    setNotImplemented(null);
    setPreviewRows(null);
    setCommitted(false);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("month", month);
      const res = await fetch("/api/finance/ledger/import/preview", { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (res.status === 501) {
        setNotImplemented(data?.error ?? "Ledger XLSX import is not yet implemented");
        return;
      }
      if (!res.ok) throw new Error(data?.error ?? "Failed to preview import");
      setPreviewRows(data.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleCommit() {
    setCommitting(true);
    setError(null);
    setNotImplemented(null);
    try {
      const res = await fetch("/api/finance/ledger/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, rows: previewRows ?? [] }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 501) {
        setNotImplemented(data?.error ?? "Ledger XLSX import is not yet implemented");
        return;
      }
      if (!res.ok) throw new Error(data?.error ?? "Failed to commit import");
      setCommitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Upload New Months</h1>
          <p className="mt-1 text-sm text-ink-500">Import a new month&apos;s cost-centre-detail ledger spreadsheet</p>
        </div>
      </div>

      <div className="rounded-xl border border-status-alert/30 bg-status-alert/5 p-3.5">
        <p className="flex items-center gap-1.5 text-xs font-medium text-status-alert">
          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} />
          Known backend gap
        </p>
        <p className="mt-1 text-[11px] text-ink-300">
          Parsing and validating an uploaded ledger XLSX was not part of the Stage 3/4 backend port. The form below
          calls real API routes, but those routes currently return &quot;not yet implemented&quot; (HTTP 501) rather
          than a fabricated result. This is a backend gap, not a UI bug.
        </p>
      </div>

      <div className="mt-4">
        <WidgetCard title="Import Ledger Spreadsheet" icon={UploadCloud}>
          <form onSubmit={handlePreview} className="space-y-2.5">
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none file:mr-3 file:rounded-md file:border-0 file:bg-base-700 file:px-2 file:py-1 file:text-ink-50"
            />
            <input
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              placeholder="Month (e.g. 2026-01)"
              className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
            />
            {error && <p className="text-xs text-status-inactive">{error}</p>}
            <button
              type="submit"
              disabled={previewing}
              className="rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
            >
              {previewing ? "Previewing…" : "Preview import"}
            </button>
          </form>

          {notImplemented && (
            <div className="mt-4 rounded-lg border border-status-alert/30 bg-status-alert/10 p-3">
              <p className="text-xs font-medium text-status-alert">Not yet implemented</p>
              <p className="mt-1 text-[11px] text-ink-300">{notImplemented}</p>
            </div>
          )}

          {previewRows && (
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-medium text-ink-50">
                  <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Preview results ({previewRows.length} rows)
                </p>
                <button
                  onClick={handleCommit}
                  disabled={committing || previewRows.length === 0}
                  className="rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
                >
                  {committing ? "Committing…" : "Commit import"}
                </button>
              </div>
              {committed && <p className="text-xs text-status-active">Import committed.</p>}
              {previewRows.length === 0 && <p className="text-xs text-ink-500">No rows parsed.</p>}
            </div>
          )}
        </WidgetCard>
      </div>
    </div>
  );
}
