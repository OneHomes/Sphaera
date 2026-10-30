"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { FinanceLedgerRow, FinanceState } from "@/lib/finance/ledgerData";
import { mo } from "@/lib/finance/financeReporting";
import { useFinanceLookups } from "./FinanceFilterContext";
import { confirmDialog, promptDialog } from "./dialogs";

// Port of the source detailModal(): the full "Individual payment" form opened from any
// payment list. Sections save through the same routes the dedicated screens use:
// invoice evidence (merchant invoices), cost behaviour (overheads), audit trail (trace),
// classification (ledger/classify) and the Finance investigation (ledger/dispute).

const NATURES: [string, string][] = [
  ["overhead", "Overhead / indirect"],
  ["direct", "Direct / project"],
  ["balance", "Balance sheet / non-P&L"],
  ["review", "Needs accounting review"],
];
const BEHAVIOURS: [string, string][] = [
  ["fixed", "Fixed"],
  ["variable", "Variable"],
  ["mixed", "Mixed / semi-variable"],
  ["oneoff", "One-off"],
  ["na", "N/A"],
];
const DISPUTE_STATUSES: [string, string][] = [
  ["Open", "Open · disputed"],
  ["Under review", "Under review with Finance"],
  ["Resolved", "Resolved"],
];

type Invoice = { id: string; supplier: string | null; documentId: string | null; documentName: string | null; amount: number | null; currency: string | null };

function usd(value: number): string {
  return `${value < 0 ? "-" : ""}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Request failed");
  return data;
}

const labelClass = "block text-[10px] font-semibold uppercase tracking-wide text-ink-500";
const inputClass =
  "mt-1 w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500 focus:border-base-600";
const smallBtn = "rounded-lg border border-base-700 px-3 py-1.5 text-xs font-medium text-ink-300 hover:border-base-600 hover:text-ink-50 disabled:opacity-50";
const primaryBtn = "rounded-lg bg-ink-50 px-4 py-2 text-xs font-semibold text-base-950 hover:opacity-90 disabled:opacity-50";

export function PaymentDetailModal({
  transaction: t,
  departments,
  managementCostHeads,
  onClose,
  onSaved,
}: {
  transaction: FinanceLedgerRow;
  departments: string[];
  managementCostHeads: string[];
  // Accepted from the pages for compatibility; the source form keeps the current original pair.
  costHeads?: FinanceState["costHeads"];
  onClose: () => void;
  onSaved: (updated: { department: string | null; costHead: string | null }) => void;
}) {
  const router = useRouter();
  const { paymentSources, subscriptions } = useFinanceLookups();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // --- Invoice evidence --------------------------------------------------------------------------
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    fetch(`/api/finance/merchant/invoices?transactionId=${encodeURIComponent(t.id)}`)
      .then((r) => (r.ok ? r.json() : { invoices: [] }))
      .then((d) => setInvoices(d.invoices ?? []))
      .catch(() => setInvoices([]));
  }, [t.id]);

  async function attachInvoice(file: File) {
    setBusy("invoice");
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("supplier", t.traceSupplier || t.reportingSupplier || t.description);
      form.append("amount", String(t.sourceAmount ?? t.amount));
      form.append("currency", t.sourceCurrency || "USD");
      const res = await fetch("/api/finance/merchant/invoices", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Invoice upload failed");
      await postJson(`/api/finance/merchant/invoices/${data.id}/link`, { transactionId: t.id });
      const list = await fetch(`/api/finance/merchant/invoices?transactionId=${encodeURIComponent(t.id)}`).then((r) => r.json());
      setInvoices(list.invoices ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invoice upload failed");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // --- Management cost behaviour ----------------------------------------------------------------
  const [nature, setNature] = useState(t.overheadOverride?.costNature ?? "");
  const [behaviour, setBehaviour] = useState(t.overheadOverride?.costBehaviour ?? "");
  async function saveBehaviour() {
    if (nature && (!behaviour || ((nature === "review" || nature === "balance") && behaviour !== "na"))) {
      setError("Choose a valid cost category and behaviour.");
      return;
    }
    if (!(await confirmDialog("Save this management classification for this payment? The original ERP details will not change.", { title: "Save classification", confirmLabel: "Save" }))) return;
    setBusy("behaviour");
    setError(null);
    try {
      await postJson("/api/finance/overheads/payment-override", { id: t.id, nature, behaviour });
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(null);
    }
  }

  // --- Audit trail + classification (saved together by "Save classification") -------------------
  const [trace, setTrace] = useState({
    paymentReference: t.paymentReference ?? "",
    erpPaymentId: t.erpPaymentId ?? "",
    invoiceReference: t.invoiceReference ?? "",
    paymentMethod: t.paymentMethod || "Unknown",
    paymentSourceId: t.paymentSourceId ?? "",
    subscriptionId: t.subscriptionId ?? "",
    supplier: t.traceSupplier ?? "",
    purpose: t.tracePurpose ?? "",
    sourceCurrency: t.sourceCurrency ?? "",
    sourceAmount: t.sourceAmount == null ? "" : String(t.sourceAmount),
    traceReviewed: t.traceReviewed,
  });
  const [department, setDepartment] = useState(t.managementDepartment ?? "");
  const [costHead, setCostHead] = useState(t.managementCostHead ?? "");
  const [extraHeads, setExtraHeads] = useState<string[]>([]);
  const [debtPeriod, setDebtPeriod] = useState(t.debtPeriod || "current");
  const [reviewed, setReviewed] = useState(t.reviewed);
  const [note, setNote] = useState(t.note ?? "");

  async function createHead() {
    const name = await promptDialog("It is added to the Finance cost head list and available on every screen.", { title: "New cost head", confirmLabel: "Add cost head", placeholder: "e.g. Performance Bonus" });
    if (!name?.trim()) return;
    try {
      await postJson("/api/finance/cost-heads", { name: name.trim() });
      setExtraHeads((prev) => [...prev, name.trim()]);
      setCostHead(name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the cost head");
    }
  }

  async function saveClassification() {
    if (Boolean(department) !== Boolean(costHead)) {
      setError("Choose both a department and a cost head.");
      return;
    }
    setBusy("save");
    setError(null);
    try {
      await postJson("/api/finance/trace/payment", { transactionId: t.id, ...trace });
      await postJson("/api/finance/ledger/classify", {
        id: t.id,
        head: t.effectiveHead && t.effectiveCentre ? t.effectiveHead : undefined,
        centre: t.effectiveHead && t.effectiveCentre ? t.effectiveCentre : undefined,
        debtPeriod,
        department: department || undefined,
        costHead: costHead || undefined,
        note: note || undefined,
        reviewed,
      });
      router.refresh();
      onSaved({ department: department || null, costHead: costHead || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(null);
    }
  }

  // --- Finance payment investigation ------------------------------------------------------------
  const [dispute, setDispute] = useState({
    status: t.dispute?.status ?? "Open",
    financeOwner: t.dispute?.financeOwner ?? "",
    reason: t.dispute?.reason ?? "",
    notes: "",
    resolution: "",
  });
  async function saveDispute() {
    if (!dispute.reason.trim()) {
      setError("Explain why this charge needs investigation.");
      return;
    }
    if (dispute.status === "Resolved" && !dispute.resolution.trim()) {
      setError("Record the Finance investigation outcome before resolving.");
      return;
    }
    if (
      !(await confirmDialog(`${t.dispute ? "Update" : "Flag"} this payment as ${dispute.status}? The ledger amount and existing classification will be unchanged.`, {
        title: t.dispute ? "Update dispute" : "Flag payment",
        confirmLabel: t.dispute ? "Update" : "Flag payment",
      }))
    )
      return;
    setBusy("dispute");
    setError(null);
    try {
      await postJson("/api/finance/ledger/dispute", {
        id: t.id,
        status: dispute.status,
        reason: dispute.reason,
        financeOwner: dispute.financeOwner || undefined,
        notes: dispute.notes || undefined,
        resolution: dispute.resolution || undefined,
      });
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update dispute");
    } finally {
      setBusy(null);
    }
  }

  const sources = paymentSources.filter((s) => s.isActive || s.id === t.paymentSourceId);
  const headOptions = Array.from(new Set([...managementCostHeads, ...extraHeads]));
  const behaviourSource = t.overheadOverride ? "Payment override" : "Not reviewed";
  const disputeOpen = t.dispute && t.dispute.status !== "Resolved";
  const parsedDate = t.date ? new Date(t.date) : null;
  const dateLabel = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString().slice(0, 10) : mo(t.month);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-base-700 bg-base-900 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-base-700 bg-base-800/60 px-6 py-5">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">Individual payment</div>
            <h2 className="mt-1 break-words text-lg font-bold text-ink-50">{t.description}</h2>
            <p className="mt-1 text-xs text-ink-500">Payment ID {t.id}</p>
          </div>
          <button type="button" onClick={onClose} className={`${smallBtn} flex shrink-0 items-center gap-1`}>
            Close <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {/* Summary blocks */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ["Amount USD", usd(t.amount), "text-2xl"],
              ["Payment date", dateLabel, "text-lg"],
              ["Country", t.country ?? "—", "text-lg"],
            ].map(([title, value, size]) => (
              <div key={title} className="rounded-xl border border-base-700 bg-base-900 p-4">
                <div className="text-xs font-medium text-ink-500">{title}</div>
                <div className={`mt-2 font-bold text-ink-50 ${size}`}>{value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border-l-4 border-base-600 bg-base-800 px-4 py-3 text-xs text-ink-300">
            <div>
              <strong className="text-ink-50">Reporting company:</strong> {t.reportingSupplier || t.description}
              {!t.traceSupplier && " · Original/unmapped label"}
            </div>
            <div className="mt-0.5">Original bank / ERP payment description: {t.description}</div>
          </div>
          <div className="rounded-lg border-l-4 border-base-600 bg-base-800 px-4 py-3 text-xs text-ink-300">
            Original Finance labels, never overwritten: {t.head ?? "—"} → {t.costCentre ?? "—"}. Source: {t.sourceSheet ?? "—"}.
          </div>

          {/* Invoice evidence */}
          <section className="rounded-xl border border-base-700 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <strong className="text-sm text-ink-50">Invoice evidence</strong>
                <p className="text-xs text-ink-500">Invoices and receipts can be attached to any payment, not just subscriptions.</p>
              </div>
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy === "invoice"} className={smallBtn}>
                {busy === "invoice" ? "Uploading…" : "+ Read / attach invoice"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && attachInvoice(e.target.files[0])}
              />
            </div>
            <div className="mt-2 space-y-1">
              {invoices === null && <p className="text-xs text-ink-500">Loading…</p>}
              {invoices?.length === 0 && <p className="text-xs text-ink-500">No invoice attached yet.</p>}
              {invoices?.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2 text-xs text-ink-300">
                  <span>
                    {i.supplier ?? "Invoice"} · {i.documentName ?? "document"}
                    {i.amount != null && <span className="text-ink-500"> ({i.currency ?? ""} {i.amount.toLocaleString()})</span>}
                  </span>
                  {i.documentId && (
                    <a href={`/api/documents/${i.documentId}/download`} target="_blank" rel="noreferrer" className="text-status-active hover:underline">
                      View document
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Management cost behaviour */}
          <section className="rounded-xl border border-base-700 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <strong className="text-sm text-ink-50">Management cost behaviour</strong>
                <p className="text-xs text-ink-500">Override the cost-head default for this payment only. Not an ERP accounting journal.</p>
              </div>
              <span className="rounded-full bg-base-800 px-2.5 py-1 text-[11px] font-medium text-ink-300">{behaviourSource}</span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                Cost nature
                <select value={nature} onChange={(e) => setNature(e.target.value)} className={inputClass}>
                  <option value="">Inherit cost-head rule</option>
                  {NATURES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className={labelClass}>
                Behaviour
                <select value={behaviour} onChange={(e) => setBehaviour(e.target.value)} className={inputClass}>
                  <option value="">Inherit rule</option>
                  {BEHAVIOURS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            </div>
            <button type="button" onClick={saveBehaviour} disabled={busy === "behaviour"} className={`${smallBtn} mt-3`}>
              {busy === "behaviour" ? "Saving…" : "Save cost behaviour tag"}
            </button>
          </section>

          {/* Bank to subscription audit trail */}
          <div className="rounded-lg border-l-4 border-base-600 bg-base-800 px-4 py-3">
            <strong className="text-xs text-ink-50">Bank to subscription audit trail</strong>
            <p className="text-xs text-ink-500">
              These references are not present in most original Excel rows. Leave unknown values blank and verify against the bank or ERP.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Bank/card transaction reference
              <input value={trace.paymentReference} onChange={(e) => setTrace({ ...trace, paymentReference: e.target.value })} placeholder="Exact statement reference" className={inputClass} />
            </label>
            <label className={labelClass}>
              ERP payment ID
              <input value={trace.erpPaymentId} onChange={(e) => setTrace({ ...trace, erpPaymentId: e.target.value })} placeholder="ERP transaction identifier" className={inputClass} />
            </label>
            <label className={labelClass}>
              Invoice / receipt reference
              <input value={trace.invoiceReference} onChange={(e) => setTrace({ ...trace, invoiceReference: e.target.value })} placeholder="Supplier invoice number" className={inputClass} />
            </label>
            <label className={labelClass}>
              Paid by
              <select value={trace.paymentMethod} onChange={(e) => setTrace({ ...trace, paymentMethod: e.target.value })} className={inputClass}>
                {["Unknown", "Bank transfer", "Company card", "Other"].map((v) => <option key={v}>{v}</option>)}
              </select>
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              Company account or card
              <select value={trace.paymentSourceId} onChange={(e) => setTrace({ ...trace, paymentSourceId: e.target.value })} className={inputClass}>
                <option value="">Not identified</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.kind}{s.lastFour ? ` · ${s.lastFour}` : ""})
                  </option>
                ))}
              </select>
              <span className="mt-1 block normal-case tracking-normal text-ink-500">
                Register accounts and cards under Payment Traceability. Only store the last four digits.
              </span>
            </label>
            <label className={labelClass}>
              Supplier or merchant
              <input value={trace.supplier} onChange={(e) => setTrace({ ...trace, supplier: e.target.value })} placeholder="e.g. Microsoft Ireland" className={inputClass} />
            </label>
            <label className={labelClass}>
              Subscription or recurring contract
              <select value={trace.subscriptionId} onChange={(e) => setTrace({ ...trace, subscriptionId: e.target.value })} className={inputClass}>
                <option value="">No identified subscription</option>
                {subscriptions.map((s) => <option key={s.id} value={s.id}>{s.supplier} / {s.service}</option>)}
              </select>
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              What exactly was bought or who uses it?
              <textarea value={trace.purpose} onChange={(e) => setTrace({ ...trace, purpose: e.target.value })} rows={2} placeholder="e.g. 25 Microsoft 365 E3 licences used by Sales" className={inputClass} />
            </label>
            <label className={labelClass}>
              Original payment currency
              <input value={trace.sourceCurrency} onChange={(e) => setTrace({ ...trace, sourceCurrency: e.target.value })} placeholder="GBP" className={inputClass} />
            </label>
            <label className={labelClass}>
              Original payment amount
              <input type="number" step="any" value={trace.sourceAmount} onChange={(e) => setTrace({ ...trace, sourceAmount: e.target.value })} placeholder="If known" className={inputClass} />
            </label>
            <label className="flex items-center gap-2 text-xs text-ink-300 sm:col-span-2">
              <input type="checkbox" checked={trace.traceReviewed} onChange={(e) => setTrace({ ...trace, traceReviewed: e.target.checked })} className="h-4 w-4 accent-status-active" />
              Payment reference, source and purpose verified against supporting evidence
            </label>
          </div>

          {/* Classification */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Department
              <select value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass}>
                <option value="">Select department</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              Simple cost head
              <select value={costHead} onChange={(e) => setCostHead(e.target.value)} className={inputClass}>
                <option value="">Select cost head</option>
                {headOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <div className="sm:col-span-2">
              <button type="button" onClick={createHead} className={`${smallBtn} w-full py-2`}>
                + Create a new cost head
              </button>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-500">Leave both fields blank to return to the source-level mapping.</p>
            </div>
            <label className={labelClass}>
              Accounting period
              <select value={debtPeriod} onChange={(e) => setDebtPeriod(e.target.value)} className={inputClass}>
                <option value="current">Current FY</option>
                <option value="2024/25">Historical debt FY2024/25</option>
                <option value="older">Older historical debt</option>
              </select>
            </label>
            <label className={labelClass}>
              Finance review
              <select value={reviewed ? "true" : "false"} onChange={(e) => setReviewed(e.target.value === "true")} className={inputClass}>
                <option value="false">Pending</option>
                <option value="true">Verified</option>
              </select>
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              Explanation / supporting reference
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={inputClass} />
            </label>
          </div>

          {t.departmentSplits.length > 0 && (
            <section className="rounded-lg border-l-4 border-base-600 bg-base-800 px-4 py-3 text-xs text-ink-300">
              <strong className="text-ink-50">Approved shared cost allocation</strong>
              <p className="text-ink-500">The source payment is one transaction. These department amounts are a snapshot of the approved allocation.</p>
              {t.departmentSplits.map((x) => (
                <div key={`${x.department}-${x.costHead}`} className="mt-1 flex justify-between">
                  <span>{x.department} · {x.costHead}</span>
                  <strong className="text-ink-50">{usd(x.amountUsd)}</strong>
                </div>
              ))}
            </section>
          )}

          {/* Finance payment investigation */}
          <section className="rounded-xl border border-status-inactive/30 bg-status-inactive/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-ink-50">⚑ Finance payment investigation</h3>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${disputeOpen ? "bg-status-inactive/15 text-status-inactive" : "bg-status-active/15 text-status-active"}`}>
                {t.dispute?.status ?? "Not disputed"}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Flag questionable charges for a sit-down with Finance. This does not remove them from spending or change the underlying ERP record.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className={labelClass}>
                Review status
                <select value={dispute.status} onChange={(e) => setDispute({ ...dispute, status: e.target.value })} className={inputClass}>
                  {DISPUTE_STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className={labelClass}>
                Finance owner
                <input value={dispute.financeOwner} onChange={(e) => setDispute({ ...dispute, financeOwner: e.target.value })} placeholder="Finance manager or team" className={inputClass} />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Why is this charge disputed?
                <textarea value={dispute.reason} onChange={(e) => setDispute({ ...dispute, reason: e.target.value })} rows={2} placeholder="Incorrect amount, duplicate, unauthorised, missing invoice..." className={inputClass} />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Investigation notes
                <textarea value={dispute.notes} onChange={(e) => setDispute({ ...dispute, notes: e.target.value })} rows={2} placeholder="What needs verifying with Finance?" className={inputClass} />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Resolution / Finance finding (required when resolved)
                <textarea value={dispute.resolution} onChange={(e) => setDispute({ ...dispute, resolution: e.target.value })} rows={2} placeholder="Verified with bank, refund requested, reclassified..." className={inputClass} />
              </label>
            </div>
            <button type="button" onClick={saveDispute} disabled={busy === "dispute"} className={`${t.dispute ? smallBtn : primaryBtn} mt-3`}>
              {busy === "dispute" ? "Saving…" : t.dispute ? "Update dispute status" : "Flag as disputed"}
            </button>
          </section>

          <div className="rounded-lg border-l-4 border-status-alert bg-status-alert/10 px-4 py-3 text-xs text-ink-300">
            A department and cost head are management classifications, not proof of accounting treatment. Validate refunds, intercompany
            transfers, assets and reimbursements with Finance. Historical debt retains the original cash movement.
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-base-700 px-6 py-4">
          <p className="min-w-0 truncate text-xs text-status-inactive">{error}</p>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={onClose} className={smallBtn}>Cancel</button>
            <button type="button" onClick={saveClassification} disabled={busy === "save"} className={primaryBtn}>
              {busy === "save" ? "Saving…" : "Save classification"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
