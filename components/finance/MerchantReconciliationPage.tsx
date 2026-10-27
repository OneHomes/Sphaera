"use client";

import { useState } from "react";
import {
  Store,
  AlertTriangle,
  FileSpreadsheet,
  UploadCloud,
  Link2,
  Search,
} from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

// Direct structural port of the source app's Merchant Reconciliation
// screen: a shared filter/toolbar (merchant, cost head, financial year,
// export scope) feeding four tabs — Merchant payments, Return completed
// Excel, Invoice library and Invoice matching. All data below comes from
// the real merchant-reconciliation API routes (app/api/finance/merchant/**),
// which are fully implemented except for one documented gap: there is no
// XLSX-byte generator/parser wired up yet (see merchantReconcileData.ts's
// own doc comments on buildMerchantReviewExportRows / validateImportRow),
// so the review workbook round-trip is exercised as CSV/JSON rather than a
// real protected .xlsx file — called out inline in the Return tab.

type ExportRow = {
  transactionId: string;
  paymentDateIso: string;
  supplier: string;
  description: string;
  paymentReference: string;
  erpPaymentId: string;
  amountUsd: number;
  product: string;
  owner: string;
  users: string;
  department: string;
  costHead: string;
  locked: Record<string, boolean>;
};

type ValidatedRow = ExportRow & {
  status: "Ready" | "Unanswered" | "Already applied";
  error: string | null;
};

type InvoiceMatch = {
  transactionId: string;
  paymentDate: string | Date;
  description: string;
  paymentAmountUsd: number;
  confidence: string;
  confirmed: boolean;
  rank: number;
};

type UploadedInvoice = {
  id: string;
  supplier: string;
  amount: number;
  currency: string;
  matches: InvoiceMatch[] | null;
  matchesLoading: boolean;
  matchError: string | null;
  linkedTransactionId: string | null;
};

type Tab = "payments" | "return" | "library" | "matching";

const FY_OPTIONS = [
  { value: "", label: "All years" },
  { value: "2025", label: "FY2025/26" },
  { value: "2026", label: "FY2026/27" },
  { value: "2027", label: "FY2027/28" },
  { value: "2028", label: "FY2028/29" },
];

const PAGE_SIZE = 15;

function usd(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
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

function statusFor(r: ExportRow): { label: string; className: string } {
  if (!r.product) return { label: "Unidentified", className: "bg-status-alert/15 text-status-alert" };
  if (r.department && r.costHead) return { label: "Classified", className: "bg-status-active/15 text-status-active" };
  return { label: "Needs cost head", className: "bg-base-700 text-ink-300" };
}

const inputClass =
  "w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500";

export function MerchantReconciliationPage({
  reviewedCount,
  totalPaymentCount,
  recentBatchCount,
  merchantOptions,
  costHeadOptions,
}: {
  reviewedCount: number;
  totalPaymentCount: number;
  recentBatchCount: number;
  merchantOptions: string[];
  costHeadOptions: string[];
}) {
  const [tab, setTab] = useState<Tab>("payments");

  // --- Shared filter toolbar ---------------------------------------------
  const [merchantQuery, setMerchantQuery] = useState("");
  const [costHead, setCostHead] = useState("");
  const [fyStart, setFyStart] = useState("");
  const [exportScope, setExportScope] = useState<"all" | "unidentified">("all");

  const [rows, setRows] = useState<ExportRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  function buildParams(): URLSearchParams {
    const params = new URLSearchParams();
    if (merchantQuery.trim()) params.set("merchant", merchantQuery.trim());
    if (costHead) params.set("costHead", costHead);
    if (fyStart) params.set("fyStart", fyStart);
    return params;
  }

  async function handleFindPayments() {
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/finance/merchant/review/export?${buildParams().toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to find payments");
      setRows(data.rows ?? []);
      setPage(1);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSearching(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    setDownloadError(null);
    try {
      let source = rows;
      if (!source) {
        const res = await fetch(`/api/finance/merchant/review/export?${buildParams().toString()}`);
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Failed to export payments");
        source = data.rows ?? [];
      }
      const scoped = exportScope === "unidentified" ? (source ?? []).filter((r) => !r.product) : source ?? [];
      const header = [
        "Payment ID (DO NOT EDIT)",
        "Date (DO NOT EDIT)",
        "Reporting supplier (DO NOT EDIT)",
        "Original payment description (DO NOT EDIT)",
        "Bank reference (DO NOT EDIT)",
        "ERP payment ID (DO NOT EDIT)",
        "Amount USD (DO NOT EDIT)",
        "Product / Subscription",
        "Subscription owner",
        "Department",
        "Cost head",
      ];
      const lines = [header.join(",")];
      for (const r of scoped) {
        lines.push(
          [
            r.transactionId,
            r.paymentDateIso,
            r.supplier,
            r.description,
            r.paymentReference,
            r.erpPaymentId,
            String(r.amountUsd),
            r.product,
            r.owner,
            r.department,
            r.costHead,
          ]
            .map((v) => csvEscape(String(v ?? "")))
            .join(",")
        );
      }
      downloadBlob(`merchant-payment-review-${new Date().toISOString().slice(0, 10)}.csv`, lines.join("\n"), "text/csv");
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Failed");
    } finally {
      setDownloading(false);
    }
  }

  // --- Return completed Excel ---------------------------------------------
  const [returnFile, setReturnFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<ValidatedRow[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [allowOverwrite, setAllowOverwrite] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [approveResult, setApproveResult] = useState<{ applied: number; skipped: number } | null>(null);

  async function handlePreviewReturn(e: React.FormEvent) {
    e.preventDefault();
    if (!returnFile) {
      setReturnError("Select the returned workbook first");
      return;
    }
    setPreviewing(true);
    setReturnError(null);
    setApproveResult(null);
    try {
      // The returned workbook's bytes are never actually read here (see
      // the gap notice below) — this calls the real, live preview
      // endpoint with no rows, which is the honest thing to send when
      // nothing has actually been parsed yet.
      const res = await fetch("/api/finance/merchant/review/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview: true, rows: [] }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to preview the returned file");
      setPreviewRows(data.rows ?? []);
    } catch (err) {
      setReturnError(err instanceof Error ? err.message : "Failed");
    } finally {
      setPreviewing(false);
    }
  }

  const readyRows = (previewRows ?? []).filter((r) => r.status === "Ready" && !r.error);
  const appliedRows = (previewRows ?? []).filter((r) => r.status === "Already applied" && !r.error);
  const errorRows = (previewRows ?? []).filter((r) => Boolean(r.error));

  async function handleApproveReturn() {
    setApproving(true);
    setReturnError(null);
    try {
      const res = await fetch("/api/finance/merchant/review/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preview: false,
          rows: readyRows,
          allowOverwrite,
          merchant: merchantQuery || undefined,
          costHead: costHead || undefined,
          fyStart: fyStart ? Number(fyStart) : undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to approve reviewed rows");
      setApproveResult({ applied: data.applied ?? 0, skipped: data.skipped ?? 0 });
      setPreviewRows(null);
      setReturnFile(null);
    } catch (err) {
      setReturnError(err instanceof Error ? err.message : "Failed");
    } finally {
      setApproving(false);
    }
  }

  // --- Invoice library / matching -----------------------------------------
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceSupplier, setInvoiceSupplier] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceCurrency, setInvoiceCurrency] = useState("USD");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [uploadedInvoices, setUploadedInvoices] = useState<UploadedInvoice[]>([]);
  const [librarySearch, setLibrarySearch] = useState("");

  async function uploadInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!invoiceFile) {
      setInvoiceError("Select an invoice file (PDF, PNG or JPEG)");
      return;
    }
    setUploadingInvoice(true);
    setInvoiceError(null);
    try {
      const formData = new FormData();
      formData.append("file", invoiceFile);
      formData.append("supplier", invoiceSupplier);
      formData.append("amount", invoiceAmount);
      formData.append("currency", invoiceCurrency);
      if (invoiceDate) formData.append("invoiceDate", invoiceDate);

      const res = await fetch("/api/finance/merchant/invoices", { method: "POST", body: formData });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to upload invoice");

      setUploadedInvoices((prev) => [
        {
          id: data.id,
          supplier: invoiceSupplier,
          amount: Number(invoiceAmount),
          currency: invoiceCurrency.toUpperCase(),
          matches: null,
          matchesLoading: false,
          matchError: null,
          linkedTransactionId: null,
        },
        ...prev,
      ]);
      setInvoiceFile(null);
      setInvoiceSupplier("");
      setInvoiceAmount("");
      setInvoiceDate("");
    } catch (err) {
      setInvoiceError(err instanceof Error ? err.message : "Failed");
    } finally {
      setUploadingInvoice(false);
    }
  }

  async function findMatches(invoiceId: string) {
    setUploadedInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? { ...inv, matchesLoading: true, matchError: null } : inv)));
    try {
      const res = await fetch(`/api/finance/merchant/invoices/${invoiceId}/matches`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to find matches");
      setUploadedInvoices((prev) =>
        prev.map((inv) => (inv.id === invoiceId ? { ...inv, matches: data.matches ?? [], matchesLoading: false } : inv))
      );
    } catch (err) {
      setUploadedInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId ? { ...inv, matchesLoading: false, matchError: err instanceof Error ? err.message : "Failed" } : inv
        )
      );
    }
  }

  async function linkMatch(invoiceId: string, transactionId: string) {
    try {
      const res = await fetch(`/api/finance/merchant/invoices/${invoiceId}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to link");
      setUploadedInvoices((prev) => prev.map((inv) => (inv.id === invoiceId ? { ...inv, linkedTransactionId: transactionId } : inv)));
    } catch {
      // Leave invoice row as-is; the "Link" button remains available to retry.
    }
  }

  const libraryInvoices = uploadedInvoices.filter((inv) =>
    librarySearch.trim() ? inv.supplier.toLowerCase().includes(librarySearch.trim().toLowerCase()) : true
  );
  const unlinkedInvoices = uploadedInvoices.filter((inv) => !inv.linkedTransactionId);

  const totalPages = rows ? Math.max(1, Math.ceil(rows.length / PAGE_SIZE)) : 1;
  const pagedRows = rows ? rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : [];
  const identifiedCount = rows ? rows.filter((r) => Boolean(r.product)).length : 0;
  const totalUsd = rows ? rows.reduce((s, r) => s + r.amountUsd, 0) : 0;

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Merchant Reconciliation</h1>
          <p className="mt-1 text-sm text-ink-500">
            Identify payments by supplier, delegate subscription research and cross-map supporting invoices. Bank and
            ERP source records remain unchanged.
          </p>
        </div>
        <span className="rounded-full bg-base-800 px-3 py-1 text-xs text-ink-300">
          {reviewedCount.toLocaleString()} of {totalPaymentCount.toLocaleString()} payments reviewed
        </span>
      </div>

      {/* Filter / toolbar */}
      <WidgetCard title="Find payments to review">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <input
              list="merchant-options"
              value={merchantQuery}
              onChange={(e) => setMerchantQuery(e.target.value)}
              placeholder="Merchant name"
              className={inputClass}
            />
            <datalist id="merchant-options">
              {merchantOptions.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <select value={costHead} onChange={(e) => setCostHead(e.target.value)} className={inputClass}>
            <option value="">All cost heads</option>
            {costHeadOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select value={fyStart} onChange={(e) => setFyStart(e.target.value)} className={inputClass}>
            {FY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select value={exportScope} onChange={(e) => setExportScope(e.target.value as "all" | "unidentified")} className={inputClass}>
            <option value="all">All matching payments</option>
            <option value="unidentified">Unidentified only</option>
          </select>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={handleFindPayments}
            disabled={searching}
            className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
          >
            <Search className="h-3.5 w-3.5" strokeWidth={1.75} />
            {searching ? "Searching..." : "Find payments"}
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="rounded-lg border border-base-700 px-3 py-2 text-xs font-medium text-ink-300 hover:bg-base-700 disabled:opacity-50"
          >
            {downloading ? "Preparing..." : "↓ Download payment review (.csv)"}
          </button>
        </div>
        {searchError && <p className="mt-2 text-xs text-status-inactive">{searchError}</p>}
        {downloadError && <p className="mt-2 text-xs text-status-inactive">{downloadError}</p>}
        <p className="mt-2 text-[11px] text-ink-500">
          Download the selected payments and send the protected file to any department or reviewer. Re-upload it once
          completed. Columns for dates, IDs, descriptions and amounts are locked.
        </p>
      </WidgetCard>

      {/* Tabs */}
      <div className="mt-4 inline-flex rounded-lg border border-base-700 bg-base-900 p-0.5">
        {([
          ["payments", "Merchant payments"],
          ["return", "Return completed Excel"],
          ["library", "Invoice library"],
          ["matching", "Invoice matching"],
        ] as Array<[Tab, string]>).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              tab === value ? "bg-base-800 text-ink-50" : "text-ink-500 hover:text-ink-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Merchant payments */}
      {tab === "payments" && (
        <div className="mt-4">
          {rows === null ? (
            <WidgetCard title="Merchant payments">
              <p className="text-xs text-ink-500">Choose one or more merchants above, then click Find payments.</p>
            </WidgetCard>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-base-700 bg-base-900 p-4">
                  <p className="text-[11px] text-ink-500">Matching payments</p>
                  <p className="mt-1 text-xl font-semibold text-ink-50">{rows.length.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-base-700 bg-base-900 p-4">
                  <p className="text-[11px] text-ink-500">Identified services</p>
                  <p className="mt-1 text-xl font-semibold text-status-active">{identifiedCount.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-base-700 bg-base-900 p-4">
                  <p className="text-[11px] text-ink-500">Total USD</p>
                  <p className="mt-1 text-xl font-semibold text-ink-50">{usd(totalUsd)}</p>
                </div>
              </div>

              <div className="mt-3 overflow-x-auto rounded-xl border border-base-700">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Payment description</th>
                      <th className="px-3 py-2">Bank / ERP reference</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Assigned subscription</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((r) => {
                      const status = statusFor(r);
                      return (
                        <tr key={r.transactionId} className="border-b border-base-800 text-ink-300 last:border-0 align-top">
                          <td className="px-3 py-2">{new Date(r.paymentDateIso).toLocaleDateString()}</td>
                          <td className="px-3 py-2">
                            <p className="text-ink-50">{r.description}</p>
                            {r.supplier && r.supplier !== r.description && (
                              <p className="mt-0.5 text-[11px] text-ink-500">{r.supplier}</p>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <p>{r.paymentReference || "—"}</p>
                            {r.erpPaymentId && <p className="text-[11px] text-ink-500">{r.erpPaymentId}</p>}
                          </td>
                          <td className="px-3 py-2 text-ink-50">{usd(r.amountUsd)}</td>
                          <td className="px-3 py-2">
                            <p>{r.product || "—"}</p>
                            {r.owner && <p className="text-[11px] text-ink-500">{r.owner}</p>}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}>{status.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {pagedRows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-ink-500">
                          No payments match these filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {rows.length > PAGE_SIZE && (
                <div className="mt-2 flex items-center justify-end gap-2 text-xs text-ink-500">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-md border border-base-700 px-2 py-1 text-ink-300 hover:bg-base-700 disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <span>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-md border border-base-700 px-2 py-1 text-ink-300 hover:bg-base-700 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Return completed Excel */}
      {tab === "return" && (
        <div className="mt-4">
          <WidgetCard title="Return completed Excel" icon={FileSpreadsheet}>
            <p className="text-xs text-ink-500">
              Finance reviews every proposed change before applying it to SQLite. A returned file cannot alter
              original payment IDs, dates or amounts. Previously classified payments cannot be replaced silently.
            </p>

            <div className="mt-3 rounded-lg border border-status-alert/30 bg-status-alert/10 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-status-alert">
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.75} />
                Known backend gap
              </p>
              <p className="mt-1 text-[11px] text-ink-300">
                Reading rows out of an uploaded .xlsx workbook isn&apos;t wired into this port yet. The preview and
                approve controls below call the real, live API end-to-end — they just always receive zero rows until
                a parser is built. This is a backend gap, not a UI bug.
              </p>
            </div>

            <form onSubmit={handlePreviewReturn} className="mt-3 space-y-2.5">
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => setReturnFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none file:mr-3 file:rounded-md file:border-0 file:bg-base-700 file:px-2 file:py-1 file:text-ink-50"
              />
              {returnError && <p className="text-xs text-status-inactive">{returnError}</p>}
              <button
                type="submit"
                disabled={previewing}
                className="rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
              >
                {previewing ? "Previewing..." : "Preview changes"}
              </button>
            </form>

            {previewRows !== null && (
              <div className="mt-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-base-700 bg-base-800 p-3">
                    <p className="text-[11px] text-ink-500">Ready</p>
                    <p className="mt-1 text-lg font-semibold text-status-active">{readyRows.length}</p>
                  </div>
                  <div className="rounded-lg border border-base-700 bg-base-800 p-3">
                    <p className="text-[11px] text-ink-500">Already applied</p>
                    <p className="mt-1 text-lg font-semibold text-ink-50">{appliedRows.length}</p>
                  </div>
                  <div className="rounded-lg border border-base-700 bg-base-800 p-3">
                    <p className="text-[11px] text-ink-500">Errors</p>
                    <p className="mt-1 text-lg font-semibold text-status-inactive">{errorRows.length}</p>
                  </div>
                </div>

                <div className="mt-3 overflow-x-auto rounded-xl border border-base-700">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                      <tr>
                        <th className="px-3 py-2">Payment</th>
                        <th className="px-3 py-2">Subscription</th>
                        <th className="px-3 py-2">Owner</th>
                        <th className="px-3 py-2">Department / cost head</th>
                        <th className="px-3 py-2">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(previewRows ?? []).map((r) => (
                        <tr key={r.transactionId} className="border-b border-base-800 text-ink-300 last:border-0">
                          <td className="px-3 py-2">{r.transactionId}</td>
                          <td className="px-3 py-2">{r.product || "—"}</td>
                          <td className="px-3 py-2">{r.owner || "—"}</td>
                          <td className="px-3 py-2">
                            {r.department || "—"} / {r.costHead || "—"}
                          </td>
                          <td className="px-3 py-2">
                            {r.error ? (
                              <span className="text-status-inactive">{r.error}</span>
                            ) : (
                              <span className="text-status-active">{r.status}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {(previewRows ?? []).length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-ink-500">
                            No rows to review yet — upload a returned workbook (file parsing not yet wired, see note
                            above).
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <label className="mt-3 flex items-center gap-2 text-xs text-ink-300">
                  <input
                    type="checkbox"
                    checked={allowOverwrite}
                    onChange={(e) => setAllowOverwrite(e.target.checked)}
                    className="rounded border-base-700 bg-base-800"
                  />
                  Allow overwriting previously reviewed payments
                </label>

                {approveResult && (
                  <p className="mt-2 text-xs text-status-active">
                    Applied {approveResult.applied}, skipped {approveResult.skipped}.
                  </p>
                )}

                <button
                  onClick={handleApproveReturn}
                  disabled={approving || readyRows.length === 0}
                  className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
                >
                  {approving ? "Approving..." : `Approve ${readyRows.length} reviewed rows`}
                </button>
              </div>
            )}
          </WidgetCard>
        </div>
      )}

      {/* Invoice library */}
      {tab === "library" && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <WidgetCard title="Upload invoice evidence" icon={UploadCloud}>
            <form onSubmit={uploadInvoice} className="space-y-2.5">
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none file:mr-3 file:rounded-md file:border-0 file:bg-base-700 file:px-2 file:py-1 file:text-ink-50"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={invoiceSupplier}
                  onChange={(e) => setInvoiceSupplier(e.target.value)}
                  placeholder="Supplier"
                  className={inputClass}
                />
                <div className="flex gap-2">
                  <input
                    value={invoiceAmount}
                    onChange={(e) => setInvoiceAmount(e.target.value)}
                    placeholder="Amount"
                    type="number"
                    className={inputClass}
                  />
                  <input
                    value={invoiceCurrency}
                    onChange={(e) => setInvoiceCurrency(e.target.value)}
                    placeholder="USD"
                    maxLength={3}
                    className="w-20 rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs uppercase text-ink-50 outline-none placeholder:text-ink-500"
                  />
                </div>
              </div>
              <input
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                type="date"
                className={inputClass}
              />
              {invoiceError && <p className="text-xs text-status-inactive">{invoiceError}</p>}
              <button
                type="submit"
                disabled={uploadingInvoice}
                className="w-full rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
              >
                {uploadingInvoice ? "Uploading..." : "Upload invoice"}
              </button>
            </form>
          </WidgetCard>

          <WidgetCard title="Uploaded invoices" icon={Search}>
            <input
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              placeholder="Search uploaded invoices by supplier"
              className={`${inputClass} mb-3`}
            />
            {libraryInvoices.length === 0 ? (
              <p className="text-xs text-ink-500">No invoices uploaded yet this session.</p>
            ) : (
              <div className="max-h-[420px] space-y-3 overflow-y-auto">
                {libraryInvoices.map((inv) => (
                  <InvoiceCard key={inv.id} inv={inv} onFindMatches={findMatches} onLink={linkMatch} />
                ))}
              </div>
            )}
          </WidgetCard>
        </div>
      )}

      {/* Invoice matching */}
      {tab === "matching" && (
        <div className="mt-4">
          <WidgetCard title="Suggested payment matches" icon={Link2}>
            {unlinkedInvoices.length === 0 ? (
              <p className="text-xs text-ink-500">
                No invoices are waiting on a confirmed match. Upload an invoice in Invoice library to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {unlinkedInvoices.map((inv) => (
                  <InvoiceCard key={inv.id} inv={inv} onFindMatches={findMatches} onLink={linkMatch} />
                ))}
              </div>
            )}
          </WidgetCard>
        </div>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-ink-600">
        <Store className="h-3 w-3" strokeWidth={1.75} />
        Vendor invoices are supporting documents. A suggested match is not a confirmed match. Review references,
        amounts and dates before linking, especially where a supplier bills several subscriptions using the same
        card.
      </p>
      {recentBatchCount > 0 && (
        <p className="mt-1 text-[11px] text-ink-600">{recentBatchCount} recent review batch(es) on file.</p>
      )}
    </div>
  );
}

function InvoiceCard({
  inv,
  onFindMatches,
  onLink,
}: {
  inv: UploadedInvoice;
  onFindMatches: (id: string) => void;
  onLink: (id: string, transactionId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-base-700 bg-base-800 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-ink-50">{inv.supplier || "Unnamed supplier"}</p>
          <p className="text-[11px] text-ink-500">
            {inv.currency} {inv.amount.toLocaleString()}
          </p>
        </div>
        <button
          onClick={() => onFindMatches(inv.id)}
          disabled={inv.matchesLoading}
          className="shrink-0 rounded-lg border border-base-700 px-2.5 py-1.5 text-[11px] font-medium text-ink-300 hover:bg-base-700 disabled:opacity-50"
        >
          {inv.matchesLoading ? "Searching..." : "Find matching payments"}
        </button>
      </div>
      {inv.matchError && <p className="mt-1 text-[11px] text-status-inactive">{inv.matchError}</p>}
      {inv.matches && inv.matches.length === 0 && <p className="mt-2 text-[11px] text-ink-500">No candidate payments found.</p>}
      {inv.matches && inv.matches.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {inv.matches.map((m) => (
            <li
              key={m.transactionId}
              className="flex items-center justify-between gap-2 rounded-md border border-base-700 bg-base-900 px-2 py-1.5 text-[11px] text-ink-300"
            >
              <div className="min-w-0">
                <p className="truncate" title={m.description}>
                  {m.description}
                </p>
                <p className="text-ink-500">
                  {new Date(m.paymentDate).toLocaleDateString()} · {usd(m.paymentAmountUsd)}
                </p>
              </div>
              <button
                onClick={() => onLink(inv.id, m.transactionId)}
                disabled={inv.linkedTransactionId === m.transactionId || m.confirmed}
                className="flex shrink-0 items-center gap-1 rounded-md bg-ink-50 px-2 py-1 text-[10px] font-medium text-base-950 hover:bg-white disabled:opacity-50"
              >
                <Link2 className="h-3 w-3" strokeWidth={1.75} />
                {m.confirmed || inv.linkedTransactionId === m.transactionId ? "Linked" : "Link"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
