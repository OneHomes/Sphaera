"use client";

import { useState } from "react";
import { Store, Sparkles, Users, ClipboardList, UploadCloud, Link2 } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import type { SupplierSuggestion } from "@/lib/finance/merchantReconcileData";

type MerchantBatch = {
  id: string;
  merchant: string | null;
  costHead: string | null;
  fyStart: number | null;
  status: string;
  createdAt: string | Date;
};

type MerchantCatalog = {
  providers: Array<{ key: string; id: string; name: string; aliases: string[] }>;
  raw: Array<{ key: string; name: string }>;
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

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-base-700 bg-base-800 p-3">
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink-50">{value}</p>
    </div>
  );
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function MerchantReconciliationPage({
  batches: initialBatches,
  suggestions,
  catalog: initialCatalog,
}: {
  batches: MerchantBatch[];
  suggestions: SupplierSuggestion[];
  catalog: MerchantCatalog;
}) {
  const [batches, setBatches] = useState(initialBatches);
  const [catalog, setCatalog] = useState(initialCatalog);

  // --- Supplier clustering ------------------------------------------------
  const [approving, setApproving] = useState<string | null>(null);
  const [providerNameDrafts, setProviderNameDrafts] = useState<Record<string, string>>({});
  const [clusterError, setClusterError] = useState<Record<string, string>>({});
  const [resolvedKeys, setResolvedKeys] = useState<Set<string>>(new Set());
  const [ungroupBusy, setUngroupBusy] = useState<string | null>(null);

  async function approveCluster(suggestion: SupplierSuggestion) {
    const providerName = (providerNameDrafts[suggestion.key] ?? suggestion.name).trim();
    if (!providerName) return;
    setApproving(suggestion.key);
    setClusterError((prev) => ({ ...prev, [suggestion.key]: "" }));
    try {
      const res = await fetch("/api/finance/merchant/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerName,
          aliases: suggestion.aliases.map((a) => a.name),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to approve cluster");
      setResolvedKeys((prev) => new Set(prev).add(suggestion.key));
      // Reflect the newly approved provider locally without a full reload.
      setCatalog((prev) => {
        const existing = prev.providers.find((p) => p.id === data.providerId);
        if (existing) {
          return {
            ...prev,
            providers: prev.providers.map((p) =>
              p.id === data.providerId
                ? { ...p, aliases: Array.from(new Set([...p.aliases, ...suggestion.aliases.map((a) => a.name)])) }
                : p
            ),
          };
        }
        return {
          ...prev,
          providers: [
            ...prev.providers,
            { key: `provider:${data.providerId}`, id: data.providerId, name: providerName, aliases: suggestion.aliases.map((a) => a.name) },
          ],
        };
      });
    } catch (err) {
      setClusterError((prev) => ({ ...prev, [suggestion.key]: err instanceof Error ? err.message : "Failed" }));
    } finally {
      setApproving(null);
    }
  }

  async function ungroupAlias(providerId: string, alias: string) {
    const key = `${providerId}:${alias}`;
    setUngroupBusy(key);
    try {
      const res = await fetch(`/api/finance/merchant/providers/${providerId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to ungroup");
      setCatalog((prev) => ({
        ...prev,
        providers: prev.providers
          .map((p) => (p.id === providerId ? { ...p, aliases: p.aliases.filter((a) => a !== alias) } : p))
          .filter((p) => p.aliases.length > 0),
      }));
    } catch {
      // Surface nothing fancy here — a failed ungroup simply leaves the row in place.
    } finally {
      setUngroupBusy(null);
    }
  }

  // --- Review batches -------------------------------------------------------
  const [batchMerchant, setBatchMerchant] = useState("");
  const [batchCostHead, setBatchCostHead] = useState("");
  const [batchFyStart, setBatchFyStart] = useState("");
  const [creatingBatch, setCreatingBatch] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  async function createBatch(e: React.FormEvent) {
    e.preventDefault();
    setCreatingBatch(true);
    setBatchError(null);
    try {
      const res = await fetch("/api/finance/merchant/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant: batchMerchant || undefined,
          costHead: batchCostHead || undefined,
          fyStart: batchFyStart ? Number(batchFyStart) : undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to create batch");
      setBatches((prev) => [
        {
          id: data.id,
          status: data.status,
          merchant: batchMerchant || null,
          costHead: batchCostHead || null,
          fyStart: batchFyStart ? Number(batchFyStart) : null,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setBatchMerchant("");
      setBatchCostHead("");
      setBatchFyStart("");
    } catch (err) {
      setBatchError(err instanceof Error ? err.message : "Failed");
    } finally {
      setCreatingBatch(false);
    }
  }

  // --- Invoice upload ---------------------------------------------------
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoiceSupplier, setInvoiceSupplier] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceCurrency, setInvoiceCurrency] = useState("USD");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);
  const [uploadedInvoices, setUploadedInvoices] = useState<UploadedInvoice[]>([]);

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

  const visibleSuggestions = suggestions.filter((s) => !resolvedKeys.has(s.key));

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Merchant Reconciliation</h1>
          <p className="mt-1 text-sm text-ink-500">
            Supplier-name clustering, Excel review batches and invoice evidence matching
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Tile label="Pending cluster suggestions" value={visibleSuggestions.length.toLocaleString()} />
        <Tile label="Approved reporting suppliers" value={catalog.providers.length.toLocaleString()} />
        <Tile label="Recent review batches" value={batches.length.toLocaleString()} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Supplier cluster suggestions */}
        <WidgetCard title="Supplier Cluster Suggestions" icon={Sparkles}>
          {visibleSuggestions.length === 0 ? (
            <p className="text-xs text-ink-500">No pending clustering suggestions. Nothing is auto-applied.</p>
          ) : (
            <div className="max-h-[420px] space-y-3 overflow-y-auto">
              {visibleSuggestions.map((s) => (
                <div key={s.key} className="rounded-lg border border-base-700 bg-base-800 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-ink-50">{s.name}</p>
                      <p className="mt-0.5 text-[11px] text-ink-500">{s.reason}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        s.confidence === "Strong match" ? "bg-status-active/15 text-status-active" : "bg-status-alert/15 text-status-alert"
                      }`}
                    >
                      {s.confidence}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-0.5 text-[11px] text-ink-300">
                    {s.aliases.slice(0, 5).map((a) => (
                      <li key={a.name} className="flex items-center justify-between">
                        <span className="truncate" title={a.name}>
                          {a.name}
                        </span>
                        <span className="shrink-0 text-ink-500">
                          {a.count}x · {formatUsd(a.usd)}
                        </span>
                      </li>
                    ))}
                    {s.aliases.length > 5 && <li className="text-ink-600">+{s.aliases.length - 5} more</li>}
                  </ul>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={providerNameDrafts[s.key] ?? s.name}
                      onChange={(e) => setProviderNameDrafts((prev) => ({ ...prev, [s.key]: e.target.value }))}
                      className="w-full rounded-lg border border-base-700 bg-base-900 px-2 py-1.5 text-xs text-ink-50 outline-none"
                    />
                    <button
                      onClick={() => approveCluster(s)}
                      disabled={approving === s.key}
                      className="shrink-0 rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
                    >
                      {approving === s.key ? "Approving…" : "Approve"}
                    </button>
                  </div>
                  {clusterError[s.key] && <p className="mt-1 text-[11px] text-status-inactive">{clusterError[s.key]}</p>}
                </div>
              ))}
            </div>
          )}
        </WidgetCard>

        {/* Approved providers / ungroup */}
        <WidgetCard title="Approved Reporting Suppliers" icon={Users}>
          {catalog.providers.length === 0 ? (
            <p className="text-xs text-ink-500">No reporting suppliers approved yet.</p>
          ) : (
            <div className="max-h-[420px] space-y-3 overflow-y-auto">
              {catalog.providers.map((p) => (
                <div key={p.id} className="rounded-lg border border-base-700 bg-base-800 p-3">
                  <p className="text-xs font-medium text-ink-50">{p.name}</p>
                  <ul className="mt-2 space-y-1">
                    {p.aliases.map((alias) => {
                      const key = `${p.id}:${alias}`;
                      return (
                        <li key={alias} className="flex items-center justify-between gap-2 text-[11px] text-ink-300">
                          <span className="truncate" title={alias}>
                            {alias}
                          </span>
                          <button
                            onClick={() => ungroupAlias(p.id, alias)}
                            disabled={ungroupBusy === key}
                            className="shrink-0 rounded-md border border-base-700 px-2 py-0.5 text-[10px] text-ink-500 hover:border-status-inactive/40 hover:text-status-inactive disabled:opacity-50"
                          >
                            {ungroupBusy === key ? "Removing…" : "Ungroup"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </WidgetCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Review batch creation */}
        <WidgetCard title="Create Review Batch" icon={ClipboardList}>
          <form onSubmit={createBatch} className="space-y-2.5">
            <div className="grid grid-cols-3 gap-2">
              <input
                value={batchMerchant}
                onChange={(e) => setBatchMerchant(e.target.value)}
                placeholder="Merchant (optional)"
                className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
              />
              <input
                value={batchCostHead}
                onChange={(e) => setBatchCostHead(e.target.value)}
                placeholder="Cost head (optional)"
                className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
              />
              <input
                value={batchFyStart}
                onChange={(e) => setBatchFyStart(e.target.value)}
                placeholder="FY start e.g. 2024"
                type="number"
                className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
              />
            </div>
            {batchError && <p className="text-xs text-status-inactive">{batchError}</p>}
            <button
              type="submit"
              disabled={creatingBatch}
              className="rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
            >
              {creatingBatch ? "Creating…" : "Create batch"}
            </button>
          </form>

          <div className="mt-4 overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-2 py-1.5">Created</th>
                  <th className="px-2 py-1.5">Merchant</th>
                  <th className="px-2 py-1.5">Cost head</th>
                  <th className="px-2 py-1.5">FY</th>
                  <th className="px-2 py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.slice(0, 10).map((b) => (
                  <tr key={b.id} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="px-2 py-1.5">{new Date(b.createdAt).toLocaleDateString()}</td>
                    <td className="px-2 py-1.5">{b.merchant ?? "—"}</td>
                    <td className="px-2 py-1.5">{b.costHead ?? "—"}</td>
                    <td className="px-2 py-1.5">{b.fyStart ?? "—"}</td>
                    <td className="px-2 py-1.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          b.status === "committed"
                            ? "bg-status-active/15 text-status-active"
                            : b.status === "exported"
                              ? "bg-status-alert/15 text-status-alert"
                              : "bg-base-700 text-ink-300"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {batches.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2 py-3 text-center text-ink-500">
                      No review batches yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </WidgetCard>

        {/* Invoice upload + matching */}
        <WidgetCard title="Invoice Evidence Upload" icon={UploadCloud}>
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
                className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
              />
              <div className="flex gap-2">
                <input
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  placeholder="Amount"
                  type="number"
                  className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500"
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
              className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none"
            />
            {invoiceError && <p className="text-xs text-status-inactive">{invoiceError}</p>}
            <button
              type="submit"
              disabled={uploadingInvoice}
              className="w-full rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
            >
              {uploadingInvoice ? "Uploading…" : "Upload invoice"}
            </button>
          </form>

          {uploadedInvoices.length > 0 && (
            <div className="mt-4 max-h-[320px] space-y-3 overflow-y-auto">
              {uploadedInvoices.map((inv) => (
                <div key={inv.id} className="rounded-lg border border-base-700 bg-base-800 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium text-ink-50">{inv.supplier || "Unnamed supplier"}</p>
                      <p className="text-[11px] text-ink-500">
                        {inv.currency} {inv.amount.toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => findMatches(inv.id)}
                      disabled={inv.matchesLoading}
                      className="shrink-0 rounded-lg border border-base-700 px-2.5 py-1.5 text-[11px] font-medium text-ink-300 hover:bg-base-700 disabled:opacity-50"
                    >
                      {inv.matchesLoading ? "Searching…" : "Find matching payments"}
                    </button>
                  </div>
                  {inv.matchError && <p className="mt-1 text-[11px] text-status-inactive">{inv.matchError}</p>}
                  {inv.matches && inv.matches.length === 0 && (
                    <p className="mt-2 text-[11px] text-ink-500">No candidate payments found.</p>
                  )}
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
                              {new Date(m.paymentDate).toLocaleDateString()} · {formatUsd(m.paymentAmountUsd)}
                            </p>
                          </div>
                          <button
                            onClick={() => linkMatch(inv.id, m.transactionId)}
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
              ))}
            </div>
          )}
        </WidgetCard>
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-ink-600">
        <Store className="h-3 w-3" strokeWidth={1.75} />
        Nothing on this page auto-applies — every grouping, batch and invoice link is an explicit action.
      </p>
    </div>
  );
}
