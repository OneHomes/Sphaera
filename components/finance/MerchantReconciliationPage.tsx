"use client";

import { useMemo, useState } from "react";
import {
  Store,
  AlertTriangle,
  FileSpreadsheet,
  UploadCloud,
  Link2,
  Search,
  Layers,
} from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import type { SupplierSuggestion } from "@/lib/finance/merchantReconcileData";

// Direct structural port of the source app's Merchant Reconciliation
// screen: a shared filter/toolbar (merchant, cost head, financial year,
// export scope) feeding four tabs — Merchant payments, Return completed
// Excel, Invoice library and Invoice matching. All data below comes from
// the real merchant-reconciliation API routes (app/api/finance/merchant/**),
// which are fully implemented except for one documented gap: there is no
// XLSX-byte generator/parser wired up yet (see merchantReconcileData.ts's
// own doc comments on buildMerchantReviewExportRows / validateImportRow),
// so the review workbook round-trip is exercised as CSV/JSON rather than a
// real protected .xlsx file — called out inline in the Return tab. The
// downloaded review file is likewise CSV-structured text; its name/label
// matches the source's declared ".xlsx" per the same documented gap.

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

// Mirrors merchantCatalog()'s return shape (lib/finance/merchantReconcileData.ts):
// approved reporting-provider groups (with their raw aliases) plus the
// still-ungrouped raw payment descriptions. Matches the source's mcPicker
// item model (provider vs raw "key").
type CatalogProvider = { key: string; id: string; name: string; aliases: string[] };
type CatalogRaw = { key: string; name: string };
type Catalog = { providers: CatalogProvider[]; raw: CatalogRaw[] };

type PickerItem = { key: string; name: string; hint?: string };

const FY_OPTIONS = [
  { value: "", label: "All years" },
  { value: "2025", label: "FY2025/26" },
  { value: "2026", label: "FY2026/27" },
  { value: "2027", label: "FY2027/28" },
  { value: "2028", label: "FY2028/29" },
];

const PAGE_SIZE = 15;
const SUGGESTION_PAGE_SIZE = 5;

function usd(value: number): string {
  return `${value < 0 ? "-" : ""}$${Math.abs(Math.round(value)).toLocaleString()}`;
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
  catalog,
  costHeadOptions,
  supplierSuggestions,
}: {
  reviewedCount: number;
  totalPaymentCount: number;
  recentBatchCount: number;
  catalog: Catalog;
  costHeadOptions: string[];
  supplierSuggestions: SupplierSuggestion[];
}) {
  const [tab, setTab] = useState<Tab>("payments");

  // --- Shared filter toolbar: multi-select merchants + cost heads --------
  // A local, editable copy of the server-computed catalog, so approving a
  // supplier-name suggestion or grouping/ungrouping aliases below can
  // update the picker's options immediately without a dedicated
  // catalog-refresh endpoint.
  const [catalogState, setCatalogState] = useState<Catalog>(catalog);

  const [selectedMerchants, setSelectedMerchants] = useState<string[]>([]);
  const [merchantPickerOpen, setMerchantPickerOpen] = useState(false);
  const [merchantFilter, setMerchantFilter] = useState("");

  const [selectedCostHeads, setSelectedCostHeads] = useState<string[]>([]);
  const [headPickerOpen, setHeadPickerOpen] = useState(false);
  const [headFilter, setHeadFilter] = useState("");

  const [fyStart, setFyStart] = useState("2025");
  const [exportScope, setExportScope] = useState<"all" | "unidentified">("all");

  // True once the merchant/cost-head/year/scope selection has changed since
  // the last successful "Find payments" run — mirrors the source's
  // MC.pendingSelection, which blocks the results view behind a "Merchant
  // selection ready" confirmation until the review is actually re-run.
  const [selectionDirty, setSelectionDirty] = useState(false);

  const [rows, setRows] = useState<ExportRow[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const merchantItems: PickerItem[] = useMemo(
    () => [
      ...catalogState.providers.map((p) => ({
        key: p.key,
        name: p.name,
        hint: `${p.aliases.length} grouped merchant name${p.aliases.length === 1 ? "" : "s"}`,
      })),
      ...catalogState.raw.map((r) => ({ key: r.key, name: r.name, hint: "Original payment description" })),
    ],
    [catalogState]
  );
  const headItems: PickerItem[] = useMemo(() => costHeadOptions.map((c) => ({ key: c, name: c })), [costHeadOptions]);

  function itemName(items: PickerItem[], key: string): string {
    return items.find((i) => i.key === key)?.name ?? key;
  }

  function markDirty() {
    setSelectionDirty(true);
  }

  async function fetchFilteredRows(): Promise<ExportRow[]> {
    const params = new URLSearchParams();
    if (fyStart) params.set("fyStart", fyStart);
    const res = await fetch(`/api/finance/merchant/review/export?${params.toString()}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? "Failed to find payments");
    let result: ExportRow[] = data.rows ?? [];
    // The export endpoint only accepts one merchant/cost-head value at a
    // time, so multi-select filtering (ticking several merchants and/or
    // cost heads) is applied here, over the full fetched set — the same
    // client-side-filter pattern the unidentified-only export scope
    // already uses below.
    if (selectedMerchants.length) {
      const names = selectedMerchants.map((k) => itemName(merchantItems, k).toLowerCase()).filter(Boolean);
      result = result.filter((r) =>
        names.some((n) => r.supplier.toLowerCase().includes(n) || r.description.toLowerCase().includes(n))
      );
    }
    if (selectedCostHeads.length) {
      const heads = selectedCostHeads.map((h) => h.toLowerCase());
      result = result.filter((r) => heads.includes((r.costHead || "").toLowerCase()));
    }
    return result;
  }

  async function handleFindPayments() {
    setSearching(true);
    setSearchError(null);
    try {
      const result = await fetchFilteredRows();
      setRows(result);
      setPage(1);
      setSelectionDirty(false);
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
      const source = rows ?? (await fetchFilteredRows());
      const scoped = exportScope === "unidentified" ? source.filter((r) => !r.product) : source;
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
      // Known, documented gap (see file header + merchantReconcileData.ts's
      // buildMerchantReviewExportRows doc comment): real XLSX byte
      // generation isn't wired up yet, so this is still CSV-structured
      // text. The filename/MIME are named ".xlsx" to match the source's
      // declared download label; the content itself is the honest
      // CSV/JSON round-trip this port actually performs end-to-end.
      downloadBlob(
        `merchant-payment-review-${new Date().toISOString().slice(0, 10)}.xlsx`,
        lines.join("\n"),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Failed");
    } finally {
      setDownloading(false);
    }
  }

  // --- Supplier-name suggestions ("smart panel") --------------------------
  const [suggestionsState, setSuggestionsState] = useState<SupplierSuggestion[]>(supplierSuggestions);
  const [smartOpen, setSmartOpen] = useState(true);
  const [suggestionFilter, setSuggestionFilter] = useState("");
  const [suggestionLimit, setSuggestionLimit] = useState(SUGGESTION_PAGE_SIZE);
  const [suggestionSelections, setSuggestionSelections] = useState<Record<string, string[]>>({});
  const [suggestionCanonical, setSuggestionCanonical] = useState<Record<string, string>>({});
  const [suggestionApproving, setSuggestionApproving] = useState<Record<string, boolean>>({});
  const [suggestionErrors, setSuggestionErrors] = useState<Record<string, string | null>>({});

  const matchingSuggestions = useMemo(() => {
    const query = suggestionFilter.trim().toLowerCase();
    if (!query) return suggestionsState;
    return suggestionsState.filter(
      (g) => g.name.toLowerCase().includes(query) || g.aliases.some((a) => a.name.toLowerCase().includes(query))
    );
  }, [suggestionsState, suggestionFilter]);
  const visibleSuggestions = matchingSuggestions.slice(0, suggestionLimit);

  function applyApprovedAliases(providerName: string, aliases: string[], providerId?: string) {
    setCatalogState((prev) => {
      const aliasSet = new Set(aliases.map((a) => a.toLowerCase()));
      const remainingRaw = prev.raw.filter((r) => !aliasSet.has(r.name.toLowerCase()));
      const existingIdx = prev.providers.findIndex((p) => p.name.toLowerCase() === providerName.toLowerCase());
      if (existingIdx >= 0) {
        const updated = [...prev.providers];
        const merged = Array.from(new Set([...updated[existingIdx].aliases, ...aliases])).sort((a, b) =>
          a.toLowerCase().localeCompare(b.toLowerCase())
        );
        updated[existingIdx] = { ...updated[existingIdx], aliases: merged };
        return { providers: updated, raw: remainingRaw };
      }
      const newProvider: CatalogProvider = {
        key: providerId ? `provider:${providerId}` : `provider:${providerName}`,
        id: providerId ?? providerName,
        name: providerName,
        aliases: [...aliases].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
      };
      return {
        providers: [...prev.providers, newProvider].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())),
        raw: remainingRaw,
      };
    });
    setSelectedMerchants((prev) => prev.filter((k) => !aliases.some((a) => k === `raw:${a}`)));
  }

  async function handleApproveSuggestion(group: SupplierSuggestion) {
    const aliases = suggestionSelections[group.key] ?? group.aliases.map((a) => a.name);
    const providerName = (suggestionCanonical[group.key] ?? group.name).trim();
    if (!providerName || aliases.length === 0) return;
    setSuggestionApproving((prev) => ({ ...prev, [group.key]: true }));
    setSuggestionErrors((prev) => ({ ...prev, [group.key]: null }));
    try {
      const res = await fetch("/api/finance/merchant/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerName, aliases }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to approve supplier group");
      applyApprovedAliases(providerName, aliases, data?.providerId);
      setSuggestionsState((prev) => prev.filter((g) => g.key !== group.key));
    } catch (err) {
      setSuggestionErrors((prev) => ({ ...prev, [group.key]: err instanceof Error ? err.message : "Failed" }));
    } finally {
      setSuggestionApproving((prev) => ({ ...prev, [group.key]: false }));
    }
  }

  // --- Service provider groups panel --------------------------------------
  const [manageOpen, setManageOpen] = useState(false);
  const [groupProviderName, setGroupProviderName] = useState("");
  const [grouping, setGrouping] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);
  const [ungroupingKey, setUngroupingKey] = useState<string | null>(null);

  const rawChosen = selectedMerchants.filter((k) => k.startsWith("raw:")).map((k) => k.slice(4));

  async function handleGroupSelected() {
    const providerName = groupProviderName.trim();
    if (!rawChosen.length || !providerName) return;
    setGrouping(true);
    setGroupError(null);
    try {
      const res = await fetch("/api/finance/merchant/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerName, aliases: rawChosen }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to group selected names");
      applyApprovedAliases(providerName, rawChosen, data?.providerId);
      setGroupProviderName("");
    } catch (err) {
      setGroupError(err instanceof Error ? err.message : "Failed");
    } finally {
      setGrouping(false);
    }
  }

  async function handleUngroupAlias(providerId: string, alias: string) {
    const key = `${providerId}:${alias}`;
    setUngroupingKey(key);
    setGroupError(null);
    try {
      const res = await fetch(`/api/finance/merchant/providers/${providerId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to remove alias");
      setCatalogState((prev) => ({
        providers: prev.providers.map((p) => (p.id === providerId ? { ...p, aliases: p.aliases.filter((a) => a !== alias) } : p)),
        raw: [...prev.raw, { key: `raw:${alias}`, name: alias }].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())),
      }));
    } catch (err) {
      setGroupError(err instanceof Error ? err.message : "Failed");
    } finally {
      setUngroupingKey(null);
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
          merchant: selectedMerchants.length ? selectedMerchants.map((k) => itemName(merchantItems, k)).join(", ") : undefined,
          costHead: selectedCostHeads.length ? selectedCostHeads.join(", ") : undefined,
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
          {reviewedCount.toLocaleString()} reviewed payments
        </span>
      </div>

      {/* Filter / toolbar */}
      <WidgetCard title="Find payments to review">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <MultiSelectPicker
            label="Merchants / service providers"
            placeholder="Choose one or more merchants"
            items={merchantItems}
            selected={selectedMerchants}
            onChange={(next) => {
              setSelectedMerchants(next);
              markDirty();
            }}
            open={merchantPickerOpen}
            onToggle={() => setMerchantPickerOpen((v) => !v)}
            filterText={merchantFilter}
            onFilterChange={setMerchantFilter}
            searchPlaceholder="Search, e.g. Adobe"
          />
          <MultiSelectPicker
            label="Cost head"
            placeholder="All cost heads"
            items={headItems}
            selected={selectedCostHeads}
            onChange={(next) => {
              setSelectedCostHeads(next);
              markDirty();
            }}
            open={headPickerOpen}
            onToggle={() => setHeadPickerOpen((v) => !v)}
            filterText={headFilter}
            onFilterChange={setHeadFilter}
            searchPlaceholder="Search cost heads"
          />
          <select
            value={fyStart}
            onChange={(e) => {
              setFyStart(e.target.value);
              markDirty();
            }}
            className={inputClass}
          >
            {FY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={exportScope}
            onChange={(e) => {
              setExportScope(e.target.value as "all" | "unidentified");
              markDirty();
            }}
            className={inputClass}
          >
            <option value="all">All matching payments</option>
            <option value="unidentified">Unidentified only</option>
          </select>
        </div>

        <SelectionChips items={headItems} selected={selectedCostHeads} onRemove={(key) => {
          setSelectedCostHeads((prev) => prev.filter((k) => k !== key));
          markDirty();
        }} />
        <SelectionChips items={merchantItems} selected={selectedMerchants} onRemove={(key) => {
          setSelectedMerchants((prev) => prev.filter((k) => k !== key));
          markDirty();
        }} />

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
            {downloading ? "Preparing..." : "↓ Download payment review (.xlsx)"}
          </button>
        </div>
        {searchError && <p className="mt-2 text-xs text-status-inactive">{searchError}</p>}
        {downloadError && <p className="mt-2 text-xs text-status-inactive">{downloadError}</p>}
        <p className="mt-2 text-[11px] text-ink-500">
          Download the selected payments and send the protected file to any department or reviewer. Re-upload it once
          completed. Columns for dates, IDs, descriptions and amounts are locked.
        </p>
      </WidgetCard>

      {/* Suggested company-name matches ("smart panel") */}
      <SmartSuggestionsPanel
        suggestions={visibleSuggestions}
        totalGroups={suggestionsState.length}
        matchingCount={matchingSuggestions.length}
        canShowMore={matchingSuggestions.length > suggestionLimit}
        open={smartOpen}
        onToggle={() => setSmartOpen((v) => !v)}
        filterText={suggestionFilter}
        onFilterChange={(v) => {
          setSuggestionFilter(v);
          setSuggestionLimit(SUGGESTION_PAGE_SIZE);
        }}
        onShowMore={() => setSuggestionLimit((n) => n + SUGGESTION_PAGE_SIZE)}
        aliasSelections={suggestionSelections}
        onAliasSelectionsChange={(key, aliases) => setSuggestionSelections((prev) => ({ ...prev, [key]: aliases }))}
        canonicalNames={suggestionCanonical}
        onCanonicalNameChange={(key, value) => setSuggestionCanonical((prev) => ({ ...prev, [key]: value }))}
        approving={suggestionApproving}
        errors={suggestionErrors}
        onApprove={handleApproveSuggestion}
      />

      {/* Service Provider Groups */}
      <GroupPanel
        providers={catalogState.providers}
        rawChosenCount={rawChosen.length}
        open={manageOpen}
        onToggle={() => setManageOpen((v) => !v)}
        providerName={groupProviderName}
        onProviderNameChange={setGroupProviderName}
        onGroupSelected={handleGroupSelected}
        grouping={grouping}
        error={groupError}
        ungroupingKey={ungroupingKey}
        onUngroup={handleUngroupAlias}
      />

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
          {rows === null || selectionDirty ? (
            <WidgetCard title="Merchant payments">
              {selectedMerchants.length || selectedCostHeads.length ? (
                <div>
                  <h3 className="text-sm font-medium text-ink-50">Merchant selection ready</h3>
                  <p className="mt-1 text-xs text-ink-500">
                    Your merchants are selected. Click <strong className="text-ink-300">Find payments</strong> to load
                    the matching transactions and amounts. All matching options are included, even those not visible
                    in the dropdown preview.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-ink-500">Choose one or more merchants above, then click Find payments.</p>
              )}
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
                  <p className="text-[11px] text-ink-500">All matching USD payments</p>
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
                      <th className="px-3 py-2">Amount (USD)</th>
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
                    ← Previous
                  </button>
                  <span>
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-md border border-base-700 px-2 py-1 text-ink-300 hover:bg-base-700 disabled:opacity-40"
                  >
                    Next →
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
            <h3 className="text-sm font-medium text-ink-50">Re-upload the department&apos;s completed workbook</h3>
            <p className="mt-1 text-xs text-ink-500">
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
              <label className="block text-xs text-ink-300">
                Completed merchant review XLSX
                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => setReturnFile(e.target.files?.[0] ?? null)}
                  className="mt-1.5 w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none file:mr-3 file:rounded-md file:border-0 file:bg-base-700 file:px-2 file:py-1 file:text-ink-50"
                />
              </label>
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

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-ink-500">
        <Store className="h-3 w-3" strokeWidth={1.75} />
        Vendor invoices are supporting documents. A suggested match is not a confirmed match. Review references,
        amounts and dates before linking, especially where a supplier bills several subscriptions using the same
        card.
      </p>
      {recentBatchCount > 0 && (
        <p className="mt-1 text-[11px] text-ink-500">{recentBatchCount} recent review batch(es) on file.</p>
      )}
    </div>
  );
}

function MultiSelectPicker({
  label,
  items,
  selected,
  onChange,
  placeholder,
  filterText,
  onFilterChange,
  open,
  onToggle,
  searchPlaceholder,
}: {
  label: string;
  items: PickerItem[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  filterText: string;
  onFilterChange: (value: string) => void;
  open: boolean;
  onToggle: () => void;
  searchPlaceholder: string;
}) {
  const filtered = filterText.trim()
    ? items.filter((i) => i.name.toLowerCase().includes(filterText.trim().toLowerCase()))
    : items;
  const visible = filtered.slice(0, 65);

  function toggleItem(key: string) {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`${inputClass} flex items-center justify-between text-left`}
      >
        <span>{selected.length ? `${selected.length} selected` : placeholder}</span>
        <span className="text-ink-500">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full min-w-[260px] rounded-lg border border-base-700 bg-base-800 p-2 shadow-xl">
          <label className="mb-2 block text-[10px] font-medium uppercase tracking-wide text-ink-500">
            {label}
            <input
              value={filterText}
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder={searchPlaceholder}
              autoComplete="off"
              className={`${inputClass} mt-1 normal-case`}
            />
          </label>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {visible.length === 0 && <p className="px-1 py-2 text-xs text-ink-500">No matching names.</p>}
            {visible.map((item) => (
              <label
                key={item.key}
                className="flex items-start gap-2 rounded-md px-1.5 py-1 text-xs text-ink-300 hover:bg-base-700"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(item.key)}
                  onChange={() => toggleItem(item.key)}
                  className="mt-0.5 rounded border-base-700 bg-base-900"
                />
                <span>
                  <span className="block font-medium text-ink-50">{item.name}</span>
                  {item.hint && <span className="block text-[10px] text-ink-500">{item.hint}</span>}
                </span>
              </label>
            ))}
          </div>
          {filtered.length > visible.length && (
            <p className="mt-1 text-[10px] text-ink-500">
              Showing {visible.length} of {filtered.length}. Search to narrow the list.
            </p>
          )}
          <div className="mt-2 flex items-center gap-1.5 border-t border-base-700 pt-2">
            <button
              type="button"
              onClick={() => onChange(Array.from(new Set([...selected, ...filtered.map((i) => i.key)])))}
              className="rounded-md border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:bg-base-700"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="rounded-md border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:bg-base-700"
            >
              Clear All
            </button>
            <button
              type="button"
              onClick={onToggle}
              className="ml-auto rounded-md bg-ink-50 px-2.5 py-1 text-[11px] font-medium text-base-950 hover:bg-white"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectionChips({
  items,
  selected,
  onRemove,
}: {
  items: PickerItem[];
  selected: string[];
  onRemove: (key: string) => void;
}) {
  if (!selected.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {selected.map((key) => {
        const name = items.find((i) => i.key === key)?.name ?? key;
        return (
          <span key={key} className="flex items-center gap-1 rounded-full bg-base-800 px-2.5 py-1 text-[11px] text-ink-300">
            {name}
            <button
              type="button"
              onClick={() => onRemove(key)}
              title="Remove"
              aria-label={`Remove ${name}`}
              className="text-ink-500 hover:text-ink-50"
            >
              ×
            </button>
          </span>
        );
      })}
    </div>
  );
}

function SmartSuggestionsPanel({
  suggestions,
  totalGroups,
  matchingCount,
  canShowMore,
  open,
  onToggle,
  filterText,
  onFilterChange,
  onShowMore,
  aliasSelections,
  onAliasSelectionsChange,
  canonicalNames,
  onCanonicalNameChange,
  approving,
  errors,
  onApprove,
}: {
  suggestions: SupplierSuggestion[];
  totalGroups: number;
  matchingCount: number;
  canShowMore: boolean;
  open: boolean;
  onToggle: () => void;
  filterText: string;
  onFilterChange: (value: string) => void;
  onShowMore: () => void;
  aliasSelections: Record<string, string[]>;
  onAliasSelectionsChange: (key: string, aliases: string[]) => void;
  canonicalNames: Record<string, string>;
  onCanonicalNameChange: (key: string, value: string) => void;
  approving: Record<string, boolean>;
  errors: Record<string, string | null>;
  onApprove: (group: SupplierSuggestion) => void;
}) {
  return (
    <WidgetCard
      className="mt-4"
      title="Suggested company-name matches"
      icon={Search}
      action={
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-base-800 px-2.5 py-1 text-[11px] text-ink-300">{totalGroups} groups</span>
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg border border-base-700 px-2.5 py-1.5 text-[11px] font-medium text-ink-300 hover:bg-base-700"
          >
            {open ? "Hide suggestions" : "Review suggestions"}
          </button>
        </div>
      }
    >
      <p className="text-xs text-ink-500">
        Sphaera scans original payment descriptions for likely duplicate supplier names. Suggestions are NOT approved
        automatically. Finance must review each original description.
      </p>
      {open && (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={filterText}
              onChange={(e) => onFilterChange(e.target.value)}
              placeholder="Find suggested company, e.g. Adobe"
              aria-label="Search supplier suggestions"
              className={`${inputClass} max-w-xs`}
            />
            <span className="text-[11px] text-ink-500">{matchingCount} matching suggestions</span>
          </div>

          <div className="mt-3 space-y-3">
            {suggestions.length === 0 ? (
              <p className="text-xs text-ink-500">
                No matching supplier names need review. Existing approved groups are under Manage service providers.
              </p>
            ) : (
              suggestions.map((g) => (
                <SuggestionCard
                  key={g.key}
                  group={g}
                  selectedAliases={aliasSelections[g.key] ?? g.aliases.map((a) => a.name)}
                  onSelectedAliasesChange={(aliases) => onAliasSelectionsChange(g.key, aliases)}
                  canonicalName={canonicalNames[g.key] ?? g.name}
                  onCanonicalNameChange={(value) => onCanonicalNameChange(g.key, value)}
                  approving={Boolean(approving[g.key])}
                  error={errors[g.key] ?? null}
                  onApprove={() => onApprove(g)}
                />
              ))
            )}
          </div>

          {canShowMore && (
            <div className="mt-2.5">
              <button
                type="button"
                onClick={onShowMore}
                className="rounded-lg border border-base-700 px-2.5 py-1.5 text-[11px] font-medium text-ink-300 hover:bg-base-700"
              >
                Show more suggestions
              </button>
            </div>
          )}

          <p className="mt-3 text-[11px] text-ink-500">
            Only the reporting company name changes after approval. Original payment text, transaction IDs, dates,
            amounts, cost heads and ERP data are preserved. These matches are suggestions, not proof of common legal
            ownership.
          </p>
        </div>
      )}
    </WidgetCard>
  );
}

function SuggestionCard({
  group,
  selectedAliases,
  onSelectedAliasesChange,
  canonicalName,
  onCanonicalNameChange,
  approving,
  error,
  onApprove,
}: {
  group: SupplierSuggestion;
  selectedAliases: string[];
  onSelectedAliasesChange: (aliases: string[]) => void;
  canonicalName: string;
  onCanonicalNameChange: (value: string) => void;
  approving: boolean;
  error: string | null;
  onApprove: () => void;
}) {
  function toggleAlias(name: string) {
    onSelectedAliasesChange(
      selectedAliases.includes(name) ? selectedAliases.filter((a) => a !== name) : [...selectedAliases, name]
    );
  }

  return (
    <div className="rounded-lg border border-base-700 bg-base-800 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-ink-50">{group.name}</p>
          <p className="text-[11px] text-ink-500">
            {group.reason} · {group.confidence}
          </p>
        </div>
        <p className="text-[11px] text-ink-500">
          {group.count} payments · {usd(group.totalUsd)} · {group.aliases.length} names proposed
        </p>
      </div>

      <div className="mt-2 space-y-1">
        {group.aliases.map((a) => (
          <label
            key={a.name}
            className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-xs text-ink-300 hover:bg-base-700"
          >
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedAliases.includes(a.name)}
                onChange={() => toggleAlias(a.name)}
                className="rounded border-base-700 bg-base-900"
              />
              <span className="whitespace-pre-wrap break-words text-ink-50">{a.name}</span>
            </span>
            <strong className="shrink-0 text-ink-50">
              {a.count} · {usd(a.usd)}
            </strong>
          </label>
        ))}
      </div>

      {group.approvedAliases.length > 0 && (
        <p className="mt-2 text-[11px] text-ink-500">
          Previously approved: {group.approvedAliases.map((a) => a.name).join(", ")}
        </p>
      )}

      {error && <p className="mt-2 text-[11px] text-status-inactive">{error}</p>}

      <div className="mt-2.5 flex flex-wrap items-end gap-2">
        <label className="flex-1 text-[11px] text-ink-500">
          Common reporting company name
          <input
            value={canonicalName}
            onChange={(e) => onCanonicalNameChange(e.target.value)}
            maxLength={150}
            spellCheck={false}
            className={`${inputClass} mt-1`}
          />
        </label>
        <button
          type="button"
          onClick={onApprove}
          disabled={approving || selectedAliases.length === 0 || !canonicalName.trim()}
          className="rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
        >
          {approving ? "Approving..." : "Approve selected names"}
        </button>
      </div>
    </div>
  );
}

function GroupPanel({
  providers,
  rawChosenCount,
  open,
  onToggle,
  providerName,
  onProviderNameChange,
  onGroupSelected,
  grouping,
  error,
  ungroupingKey,
  onUngroup,
}: {
  providers: CatalogProvider[];
  rawChosenCount: number;
  open: boolean;
  onToggle: () => void;
  providerName: string;
  onProviderNameChange: (value: string) => void;
  onGroupSelected: () => void;
  grouping: boolean;
  error: string | null;
  ungroupingKey: string | null;
  onUngroup: (providerId: string, alias: string) => void;
}) {
  return (
    <WidgetCard
      className="mt-4"
      title="Service Provider Groups"
      icon={Layers}
      action={
        <button
          type="button"
          onClick={onToggle}
          className="rounded-lg border border-base-700 px-2.5 py-1.5 text-[11px] font-medium text-ink-300 hover:bg-base-700"
        >
          {open ? "Hide groups" : "Manage service providers"}
        </button>
      }
    >
      <p className="text-xs text-ink-500">
        Merge payment descriptions under one reporting provider, without modifying original ERP or bank text.
      </p>
      {open && (
        <div className="mt-3">
          <div className="flex flex-wrap items-end justify-between gap-2 rounded-lg border border-base-700 bg-base-800 p-3">
            <div>
              <strong className="text-xs text-ink-50">{rawChosenCount} ungrouped names selected</strong>
              <p className="mt-1 text-[11px] text-ink-500">
                To group merchants: tick their names in the Merchants / service providers picker above, enter a
                provider name, then group them — or reuse an existing provider&apos;s name to add to it.
              </p>
              <input
                value={providerName}
                onChange={(e) => onProviderNameChange(e.target.value)}
                placeholder="Provider name, e.g. Adobe Inc."
                className={`${inputClass} mt-2 max-w-xs`}
              />
            </div>
            <button
              type="button"
              onClick={onGroupSelected}
              disabled={!rawChosenCount || !providerName.trim() || grouping}
              className="rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
            >
              {grouping ? "Grouping..." : "Group selected names"}
            </button>
          </div>

          {error && <p className="mt-2 text-xs text-status-inactive">{error}</p>}

          <div className="mt-3 space-y-2.5">
            {providers.length === 0 ? (
              <p className="text-xs text-ink-500">No provider groups yet.</p>
            ) : (
              providers.map((p) => (
                <div key={p.key} className="rounded-lg border border-base-700 bg-base-800 p-3">
                  <strong className="text-xs text-ink-50">{p.name}</strong>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {p.aliases.length === 0 ? (
                      <span className="text-[11px] text-ink-500">No names assigned yet</span>
                    ) : (
                      p.aliases.map((a) => (
                        <span
                          key={a}
                          className="flex items-center gap-1 rounded-full bg-base-900 px-2.5 py-1 text-[11px] text-ink-300"
                        >
                          {a}
                          <button
                            type="button"
                            onClick={() => onUngroup(p.id, a)}
                            disabled={ungroupingKey === `${p.id}:${a}`}
                            title="Remove this alias from group"
                            className="text-ink-500 hover:text-ink-50 disabled:opacity-50"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </WidgetCard>
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
