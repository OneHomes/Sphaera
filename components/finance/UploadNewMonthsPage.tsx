"use client";

import { useState } from "react";
import { UploadCloud, AlertTriangle, FileSpreadsheet, History } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

// Direct structural port of the source app's "Upload more months" screen
// (import a ledger/cost-centre-detail XLSX, preview before saving, approve
// or cancel, then a running import history). The backend that actually
// parses an uploaded XLSX was never part of the Stage 3/4 port — see the
// doc comments on the two routes this screen calls
// (app/api/finance/ledger/import/{preview,commit}/route.ts) — so both
// calls below always surface an honest HTTP 501, never a fabricated
// preview. The "Import review" panel's shape mirrors the original screen
// exactly and will render for real the moment that backend exists.

type ImportHistoryRow = {
  id: string;
  filename: string;
  addedCount: number;
  skippedCount: number;
  invalidCount: number;
  addedAmount: number;
  createdAt: string | Date;
};

type PreviewResult = {
  filename: string;
  rowsChecked: number;
  newPayments: number;
  alreadyInSql: number;
  newAmountUsd: number;
  invalidRows: number;
  monthsAdded: string[];
  mode: string;
  warning: string;
  newHeads: string[];
  sampleNewPayments: Array<{ month: string; description: string; amountUsd: number; head: string }>;
};

function usd(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

export function UploadNewMonthsPage({ importHistory }: { importHistory: ImportHistoryRow[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [checking, setChecking] = useState(false);
  const [approving, setApproving] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [notImplemented, setNotImplemented] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);

  async function handleCheckFile(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Select the One Homes Excel file first");
      return;
    }
    setChecking(true);
    setError(null);
    setNotImplemented(null);
    setPreview(null);
    setApproved(false);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/finance/ledger/import/preview", { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (res.status === 501) {
        setNotImplemented(data?.error ?? "Ledger XLSX import is not yet implemented");
        return;
      }
      if (!res.ok) throw new Error(data?.error ?? "Failed to check file");
      setPreview(data as PreviewResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setChecking(false);
    }
  }

  async function handleApprove() {
    if (!preview) return;
    setApproving(true);
    setError(null);
    setNotImplemented(null);
    try {
      const res = await fetch("/api/finance/ledger/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: preview.filename }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 501) {
        setNotImplemented(data?.error ?? "Ledger XLSX import is not yet implemented");
        return;
      }
      if (!res.ok) throw new Error(data?.error ?? "Failed to add payments to SQL");
      setApproved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setApproving(false);
    }
  }

  function cancelPreview() {
    setPreview(null);
    setApproved(false);
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-50">Upload more months without overwriting the database</h1>
        <p className="mt-1 text-sm text-ink-500">
          Upload the original One Homes Excel format. The system reads transaction-level rows, checks existing
          payments and shows a preview before anything is saved.
        </p>
      </div>

      <div className="rounded-xl border border-status-alert/30 bg-status-alert/5 p-3.5">
        <p className="flex items-center gap-1.5 text-xs font-medium text-status-alert">
          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} />
          Known backend gap
        </p>
        <p className="mt-1 text-[11px] text-ink-300">
          Parsing and validating an uploaded ledger XLSX was not part of the Stage 3/4 backend port. The form below
          calls the real API routes, but those routes currently return &quot;not yet implemented&quot; (HTTP 501)
          rather than a fabricated preview. This is a backend gap, not a UI bug.
        </p>
      </div>

      <div className="mt-4">
        <WidgetCard title="Check the file for new payments" icon={UploadCloud}>
          <h3 className="text-sm font-medium text-ink-50">Select your updated sales and marketing workbook</h3>
          <p className="mt-1 text-[11px] text-ink-500">
            .xlsx format, existing Cost Centre Detail or monthly Sales & Marketing / Marketing tabs, 25 MB maximum
          </p>
          <form onSubmit={handleCheckFile} className="mt-3 space-y-2.5">
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none file:mr-3 file:rounded-md file:border-0 file:bg-base-700 file:px-2 file:py-1 file:text-ink-50"
            />
            {error && <p className="text-xs text-status-inactive">{error}</p>}
            <button
              type="submit"
              disabled={checking}
              className="rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
            >
              {checking ? "Checking payments..." : "Check file for new payments"}
            </button>
          </form>
          <p className="mt-3 text-[11px] text-ink-500">
            Existing payments are compared using date, description, amount and country, including the number of
            identical entries. If the file contains November to July again, those rows should be skipped rather than
            imported twice. Changes you made to cost heads or debt categories remain saved.
          </p>

          {notImplemented && (
            <div className="mt-4 rounded-lg border border-status-alert/30 bg-status-alert/10 p-3">
              <p className="text-xs font-medium text-status-alert">Not yet implemented</p>
              <p className="mt-1 text-[11px] text-ink-300">{notImplemented}</p>
            </div>
          )}
        </WidgetCard>
      </div>

      {preview && (
        <div className="mt-4">
          <WidgetCard
            title={`Import review: ${preview.filename}`}
            icon={FileSpreadsheet}
            action={
              preview.newPayments > 0 ? (
                <span className="rounded-full bg-status-active/15 px-2 py-0.5 text-[11px] font-medium text-status-active">
                  Ready to add new transactions
                </span>
              ) : (
                <span className="rounded-full bg-status-alert/15 px-2 py-0.5 text-[11px] font-medium text-status-alert">
                  No new rows found
                </span>
              )
            }
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-base-700 bg-base-800 p-3">
                <p className="text-[11px] text-ink-500">Rows checked</p>
                <p className="mt-1 text-lg font-semibold text-ink-50">{preview.rowsChecked.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-base-700 bg-base-800 p-3">
                <p className="text-[11px] text-ink-500">New payments</p>
                <p className="mt-1 text-lg font-semibold text-status-active">{preview.newPayments.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-base-700 bg-base-800 p-3">
                <p className="text-[11px] text-ink-500">Already in SQL</p>
                <p className="mt-1 text-lg font-semibold text-ink-50">{preview.alreadyInSql.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border border-base-700 bg-base-800 p-3">
                <p className="text-[11px] text-ink-500">New amount</p>
                <p className="mt-1 text-lg font-semibold text-ink-50">{usd(preview.newAmountUsd)}</p>
              </div>
            </div>

            <p className="mt-3 text-[11px] text-ink-500">
              {preview.invalidRows > 0
                ? `${preview.invalidRows} row(s) could not be read and will be skipped. `
                : ""}
              {preview.mode} used. Months being added: {preview.monthsAdded.length ? preview.monthsAdded.join(", ") : "none"}.
              <br />
              {preview.warning}
            </p>

            {preview.newHeads.length > 0 && (
              <div className="mt-3 rounded-lg border border-status-alert/30 bg-status-alert/10 p-3 text-[11px] text-status-alert">
                {preview.newHeads.length} uploaded cost-head combinations are not in your current classification
                dropdown. These rows will retain their imported head, but reallocations will continue to use only the
                original approved heads.
              </div>
            )}

            <h3 className="mt-3 text-xs font-medium text-ink-50">Sample new payments</h3>
            <div className="mt-1 overflow-x-auto rounded-xl border border-base-700">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                  <tr>
                    <th className="px-3 py-2">Month</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2">USD</th>
                    <th className="px-3 py-2">Head</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleNewPayments.map((row, i) => (
                    <tr key={i} className="border-b border-base-800 text-ink-300 last:border-0">
                      <td className="px-3 py-2">{row.month}</td>
                      <td className="px-3 py-2">{row.description}</td>
                      <td className="px-3 py-2">{usd(row.amountUsd)}</td>
                      <td className="px-3 py-2">{row.head}</td>
                    </tr>
                  ))}
                  {preview.sampleNewPayments.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-ink-500">
                        No sample rows to show.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {approved && <p className="mt-3 text-xs text-status-active">Payments added to SQL.</p>}
            {notImplemented && (
              <div className="mt-3 rounded-lg border border-status-alert/30 bg-status-alert/10 p-3">
                <p className="text-xs font-medium text-status-alert">Not yet implemented</p>
                <p className="mt-1 text-[11px] text-ink-300">{notImplemented}</p>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <button
                onClick={handleApprove}
                disabled={approving || approved || preview.newPayments === 0}
                className="rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
              >
                {approving ? "Adding..." : `Approve and add ${preview.newPayments} payments to SQL`}
              </button>
              <button
                onClick={cancelPreview}
                className="rounded-lg border border-base-700 px-3 py-2 text-xs font-medium text-ink-300 hover:bg-base-700"
              >
                Cancel preview
              </button>
            </div>
          </WidgetCard>
        </div>
      )}

      <div className="mt-4">
        <WidgetCard title="Recent import history" icon={History}>
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Imported at</th>
                  <th className="px-3 py-2">File</th>
                  <th className="px-3 py-2">Added</th>
                  <th className="px-3 py-2">Skipped</th>
                  <th className="px-3 py-2">Total new USD</th>
                </tr>
              </thead>
              <tbody>
                {importHistory.map((row) => (
                  <tr key={row.id} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2 text-ink-50">{row.filename}</td>
                    <td className="px-3 py-2">{row.addedCount.toLocaleString()}</td>
                    <td className="px-3 py-2">{row.skippedCount.toLocaleString()}</td>
                    <td className="px-3 py-2">{usd(row.addedAmount)}</td>
                  </tr>
                ))}
                {importHistory.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-ink-500">
                      No additional files have been imported yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </WidgetCard>
      </div>
    </div>
  );
}
