"use client";

import { useMemo, useState } from "react";
import { Plus, Calculator, CheckCircle2, Network } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { PaymentsTable } from "./PaymentsTable";
import { useFilteredFinanceRows } from "./FinanceFilterContext";
import type { FinanceLedgerRow } from "@/lib/finance/ledgerData";

type PaymentSource = {
  id: string;
  name: string;
  kind: string;
  legalEntity: string | null;
  institution: string | null;
  currency: string | null;
  lastFour: string | null;
  note: string | null;
  isActive: boolean;
};

type Subscription = {
  id: string;
  supplier: string;
  service: string;
  purpose: string | null;
  department: string | null;
  costHead: string | null;
  owner: string | null;
  billingCycle: string | null;
  expectedAmount: number | null;
  currency: string | null;
  renewalDate: string | null;
  status: string;
  vendorReference: string | null;
  licenceCount: number | null;
  notes: string | null;
};

type SubscriptionUser = {
  id: string;
  subscriptionId: string;
  userEmail: string;
  userName: string | null;
  team: string | null;
  licenceType: string | null;
  licenceCost: number | null;
  licenceQuantity: number | null;
};

type ErpStagingRecord = {
  id: string;
  externalId: string;
  rawJson: string;
};

type TraceState = {
  paymentSources: PaymentSource[];
  subscriptions: Subscription[];
  subscriptionUsers: SubscriptionUser[];
  unmatchedErpRecords: number;
  erpStaging: ErpStagingRecord[];
};

type SplitSlice = { department: string; costHead: string; amountUsd: number; licences: number; licenceWeight: number };
type SplitPreview = {
  ok: true;
  subscriptionId: string;
  service: string;
  costHead: string;
  licences: number;
  seatCounts: Record<string, number>;
  seatWeights: Record<string, number>;
  allocationMethod: "price-weighted" | "equal-seat";
  licenceCurrency: string;
  linkedPayments: number;
  eligiblePayments: number;
  excludedHistorical: number;
  alreadyApproved: number;
  totalUsd: number;
  samplePayment: { id: string; month: string; amountUsd: number; slices: SplitSlice[] };
  departmentTotals: Record<string, number>;
  approvedPayments?: number;
};

const SOURCE_KINDS = ["Bank account", "Company card", "Other"] as const;
const BILLING_CYCLES = ["Monthly", "Quarterly", "Annual", "One-off", ""];

function formatUsd(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function Kpi({ title, value, detail, color }: { title: string; value: string; detail: string; color?: string }) {
  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <p className="text-[11px] text-ink-500">{title}</p>
      <p className={`mt-1 text-xl font-semibold ${color ?? "text-ink-50"}`}>{value}</p>
      <p className="mt-1 text-[11px] text-ink-500">{detail}</p>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500";
const fieldLabelClass = "block text-[11px] text-ink-500 mb-1";

type UserDraft = {
  email: string;
  team: string;
  licenceType: string;
  licenceCost: string;
};

function emptyUserDraft(): UserDraft {
  return { email: "", team: "", licenceType: "", licenceCost: "" };
}

export function PaymentTraceabilityPage({
  state,
  transactions: allTransactions,
  departments,
  costHeads,
}: {
  state: TraceState;
  transactions: FinanceLedgerRow[];
  departments: string[];
  costHeads: string[];
}) {
  // Scoped by the global Finance filter bar (Financial year / From month /
  // To month / Department / Country / Search payments) — tracePage() in
  // the source app calls filt() first, exactly like this.
  const transactions = useFilteredFinanceRows(allTransactions);
  const [sources, setSources] = useState(state.paymentSources);
  const [subscriptions, setSubscriptions] = useState(state.subscriptions);
  const [subscriptionUsers, setSubscriptionUsers] = useState(state.subscriptionUsers);
  const [erpStaging, setErpStaging] = useState(state.erpStaging);

  // --- "Company bank accounts and cards" inline form (not a modal — the
  // original keeps this permanently visible with an edit-in-place state) ---
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const editingSource = sources.find((s) => s.id === editingSourceId) ?? null;
  const [srcName, setSrcName] = useState("");
  const [srcKind, setSrcKind] = useState<(typeof SOURCE_KINDS)[number]>("Bank account");
  const [srcLastFour, setSrcLastFour] = useState("");
  const [srcInstitution, setSrcInstitution] = useState("");
  const [srcCurrency, setSrcCurrency] = useState("");
  const [srcEntity, setSrcEntity] = useState("");
  const [savingSource, setSavingSource] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);

  function startEditSource(s: PaymentSource | null) {
    setEditingSourceId(s?.id ?? "new");
    setSrcName(s?.name ?? "");
    setSrcKind((s?.kind as (typeof SOURCE_KINDS)[number]) ?? "Bank account");
    setSrcLastFour(s?.lastFour ?? "");
    setSrcInstitution(s?.institution ?? "");
    setSrcCurrency(s?.currency ?? "");
    setSrcEntity(s?.legalEntity ?? "");
    setSourceError(null);
  }

  async function saveSource() {
    if (savingSource) return;
    setSavingSource(true);
    setSourceError(null);
    try {
      const res = await fetch("/api/finance/trace/payment-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingSource?.id,
          name: srcName,
          kind: srcKind,
          lastFour: srcLastFour,
          institution: srcInstitution,
          currency: srcCurrency,
          legalEntity: srcEntity,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to save source");
      const saved: PaymentSource = {
        id: data.id,
        name: srcName,
        kind: srcKind,
        legalEntity: srcEntity || null,
        institution: srcInstitution || null,
        currency: srcCurrency || null,
        lastFour: srcLastFour || null,
        note: editingSource?.note ?? null,
        isActive: true,
      };
      setSources((prev) => {
        const exists = prev.some((s) => s.id === saved.id);
        return exists ? prev.map((s) => (s.id === saved.id ? saved : s)) : [...prev, saved];
      });
      setEditingSourceId(null);
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSavingSource(false);
    }
  }

  // --- "Subscription and service register" inline form ---
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const editingSub = subscriptions.find((s) => s.id === editingSubId) ?? null;
  const [subSupplier, setSubSupplier] = useState("");
  const [subService, setSubService] = useState("");
  const [subPurpose, setSubPurpose] = useState("");
  const [subOwner, setSubOwner] = useState("");
  const [subCycle, setSubCycle] = useState("");
  const [subAmount, setSubAmount] = useState("");
  const [subCurrency, setSubCurrency] = useState("");
  const [subSeats, setSubSeats] = useState("");
  const [subVendorRef, setSubVendorRef] = useState("");
  const [subDept, setSubDept] = useState("");
  const [subCostHead, setSubCostHead] = useState("");
  const [subNotes, setSubNotes] = useState("");
  const [subLicenceRows, setSubLicenceRows] = useState<UserDraft[]>([emptyUserDraft()]);
  const [savingSub, setSavingSub] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  function startEditSub(s: Subscription | null) {
    setEditingSubId(s?.id ?? "new");
    setSubSupplier(s?.supplier ?? "");
    setSubService(s?.service ?? "");
    setSubPurpose(s?.purpose ?? "");
    setSubOwner(s?.owner ?? "");
    setSubCycle(s?.billingCycle ?? "");
    setSubAmount(s?.expectedAmount?.toString() ?? "");
    setSubCurrency(s?.currency ?? "");
    setSubSeats(s?.licenceCount?.toString() ?? "");
    setSubVendorRef(s?.vendorReference ?? "");
    setSubDept(s?.department ?? "");
    setSubCostHead(s?.costHead ?? "");
    setSubNotes(s?.notes ?? "");
    const users = s ? subscriptionUsers.filter((u) => u.subscriptionId === s.id) : [];
    setSubLicenceRows(
      users.length
        ? users.map((u) => ({
            email: u.userEmail,
            team: u.team ?? "",
            licenceType: u.licenceType ?? "",
            licenceCost: u.licenceCost !== null ? String(u.licenceCost) : "",
          }))
        : [emptyUserDraft()]
    );
    setSubError(null);
  }

  async function saveSubscription() {
    if (savingSub) return;
    setSavingSub(true);
    setSubError(null);
    try {
      const cleanUsers = subLicenceRows
        .filter((u) => u.email.trim())
        .map((u) => ({
          email: u.email.trim(),
          team: u.team.trim() || undefined,
          licenceType: u.licenceType.trim() || undefined,
          licenceCost: u.licenceCost.trim() === "" ? null : Number(u.licenceCost),
        }));
      const res = await fetch("/api/finance/trace/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingSub?.id,
          supplier: subSupplier,
          service: subService,
          purpose: subPurpose || undefined,
          owner: subOwner || undefined,
          billingCycle: subCycle || undefined,
          expectedAmount: subAmount.trim() === "" ? null : Number(subAmount),
          currency: subCurrency || undefined,
          licenceCount: subSeats.trim() === "" ? undefined : Number(subSeats),
          vendorReference: subVendorRef || undefined,
          department: subDept || undefined,
          costHead: subCostHead || undefined,
          notes: subNotes || undefined,
          users: cleanUsers,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to save subscription");
      const saved: Subscription = {
        id: data.id,
        supplier: subSupplier,
        service: subService,
        purpose: subPurpose || null,
        department: subDept || null,
        costHead: subCostHead || null,
        owner: subOwner || null,
        billingCycle: subCycle || null,
        expectedAmount: subAmount.trim() === "" ? null : Number(subAmount),
        currency: subCurrency || null,
        renewalDate: editingSub?.renewalDate ?? null,
        status: editingSub?.status ?? "Active",
        vendorReference: subVendorRef || null,
        licenceCount: cleanUsers.length,
        notes: subNotes || null,
      };
      setSubscriptions((prev) => {
        const exists = prev.some((s) => s.id === saved.id);
        return exists ? prev.map((s) => (s.id === saved.id ? saved : s)) : [...prev, saved];
      });
      setSubscriptionUsers((prev) => [
        ...prev.filter((u) => u.subscriptionId !== saved.id),
        ...cleanUsers.map((u, i) => ({
          id: `${saved.id}-${i}`,
          subscriptionId: saved.id,
          userEmail: u.email,
          userName: null,
          team: u.team ?? null,
          licenceType: u.licenceType ?? null,
          licenceCost: u.licenceCost ?? null,
          licenceQuantity: 1,
        })),
      ]);
      setEditingSubId(null);
      setPreview(null);
    } catch (err) {
      setSubError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSavingSub(false);
    }
  }

  // --- Shared-cost split preview/approve (Allocate costs) ---
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const selectedSub = subscriptions.find((s) => s.id === selectedSubId) ?? null;
  const [preview, setPreview] = useState<SplitPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveMessage, setApproveMessage] = useState<string | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);

  async function calculateSplit(sub: Subscription) {
    setSelectedSubId(sub.id);
    if (previewLoading) return;
    setPreviewLoading(true);
    setPreviewError(null);
    setApproveMessage(null);
    try {
      const res = await fetch("/api/finance/trace/subscription/split-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: sub.id, replaceExisting }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to compute split preview");
      setPreview(data);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Failed");
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function approveSplit() {
    if (!selectedSub || !preview || approving) return;
    setApproving(true);
    setApproveMessage(null);
    try {
      const res = await fetch("/api/finance/trace/subscription/split-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: selectedSub.id, replaceExisting }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to approve split");
      setPreview(data);
      setApproveMessage(
        `Approved — ${data.approvedPayments ?? 0} payment(s) split across ${Object.keys(data.departmentTotals ?? {}).length} department(s).`
      );
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Failed");
    } finally {
      setApproving(false);
    }
  }

  // --- KPIs, exactly matching the original tracePage() cards ---
  const missingBankReference = useMemo(() => transactions.filter((t) => !t.paymentReference).length, [transactions]);
  const missingSourceAccount = useMemo(() => transactions.filter((t) => !t.paymentSourceId).length, [transactions]);
  const reviewedCount = useMemo(() => transactions.filter((t) => t.traceReviewed).length, [transactions]);

  // --- "Find payments to investigate" search ---
  const [traceSearch, setTraceSearch] = useState("");
  const [sourceFilterId, setSourceFilterId] = useState<string | null>(null);
  const [subFilterId, setSubFilterId] = useState<string | null>(null);
  const searchResults = useMemo(() => {
    const q = traceSearch.trim().toLowerCase();
    let rows = transactions;
    if (sourceFilterId) rows = rows.filter((t) => t.paymentSourceId === sourceFilterId);
    if (subFilterId) rows = rows.filter((t) => t.subscriptionId === subFilterId);
    if (q) {
      rows = rows.filter((t) =>
        [t.description, t.paymentReference, t.erpPaymentId, t.invoiceReference, t.traceSupplier, t.tracePurpose]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }
    return rows;
  }, [transactions, traceSearch, sourceFilterId, subFilterId]);
  const cappedResults = searchResults.slice(0, 300);

  // --- Lightweight per-payment trace editor (bank ref / account / service / user) ---
  const [editingTx, setEditingTx] = useState<FinanceLedgerRow | null>(null);
  const [traceForm, setTraceForm] = useState({
    paymentReference: "",
    erpPaymentId: "",
    invoiceReference: "",
    paymentMethod: "Unknown",
    paymentSourceId: "",
    supplier: "",
    subscriptionId: "",
    purpose: "",
    sourceCurrency: "",
    sourceAmount: "",
    traceReviewed: false,
  });
  const [savingTrace, setSavingTrace] = useState(false);
  const [traceError, setTraceError] = useState<string | null>(null);

  function openTraceEditor(row: FinanceLedgerRow) {
    setEditingTx(row);
    setTraceForm({
      paymentReference: row.paymentReference ?? "",
      erpPaymentId: row.erpPaymentId ?? "",
      invoiceReference: row.invoiceReference ?? "",
      paymentMethod: row.paymentMethod || "Unknown",
      paymentSourceId: row.paymentSourceId ?? "",
      supplier: row.traceSupplier ?? "",
      subscriptionId: row.subscriptionId ?? "",
      purpose: row.tracePurpose ?? "",
      sourceCurrency: row.sourceCurrency ?? "",
      sourceAmount: row.sourceAmount !== null ? String(row.sourceAmount) : "",
      traceReviewed: row.traceReviewed,
    });
    setTraceError(null);
  }

  async function saveTrace() {
    if (!editingTx || savingTrace) return;
    setSavingTrace(true);
    setTraceError(null);
    try {
      const res = await fetch("/api/finance/trace/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId: editingTx.id, ...traceForm }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to save");
      setEditingTx(null);
    } catch (err) {
      setTraceError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSavingTrace(false);
    }
  }

  // --- Incoming ERP records ---
  const [erpMatchTargetId, setErpMatchTargetId] = useState<string | null>(null);
  const [matchingErp, setMatchingErp] = useState(false);

  async function linkErpToTransaction(stagingId: string, transactionId: string) {
    setMatchingErp(true);
    try {
      const res = await fetch("/api/finance/trace/erp-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stagingId, transactionId }),
      });
      if (!res.ok) throw new Error("Failed to match");
      setErpStaging((prev) => prev.filter((r) => r.id !== stagingId));
      setErpMatchTargetId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setMatchingErp(false);
    }
  }

  const erpRecordsParsed = erpStaging.map((r) => {
    let parsed: { supplier?: string; bankReference?: string; invoiceReference?: string } = {};
    try {
      parsed = JSON.parse(r.rawJson);
    } catch {
      // ignore malformed payloads — rendered as blanks below, matching the original's silent catch
    }
    return { ...r, parsed };
  });

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-ink-50">
          Trace every payment back to a bank account, card and its real purpose
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Build your company account register, link repeated payments to specific subscriptions, and record the
          staff or teams using each service. Source transactions and existing cost-head classifications are
          preserved.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Missing bank reference" value={missingBankReference.toLocaleString()} detail="Confirm from bank statement or ERP" />
        <Kpi title="Source account unknown" value={missingSourceAccount.toLocaleString()} detail="Identify which card or bank account paid" />
        <Kpi title="Subscriptions registered" value={subscriptions.length.toLocaleString()} detail="Products and services with named owners" />
        <Kpi title="Bank references verified" value={reviewedCount.toLocaleString()} detail="Checked against primary evidence" />
      </div>

      <div className="mt-4 rounded-xl border border-tier-gold/30 bg-tier-gold/10 p-3 text-xs text-tier-gold">
        Original workbook rows rarely include true payment references or payment instrument IDs. The system will
        not invent them. Microsoft transactions may cover multiple licences and products; a merchant name alone is
        not enough to map the subscription.
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WidgetCard title="Company bank accounts and cards">
          <p className="mb-3 text-[11px] text-ink-500">
            Use a friendly label, entity, issuing bank and last 4 digits only. Never enter complete card numbers,
            CVVs, bank login details or PINs.
          </p>
          <div className="space-y-2.5">
            <div>
              <label className={fieldLabelClass}>Account/card label</label>
              <input
                value={srcName}
                onChange={(e) => setSrcName(e.target.value)}
                placeholder="One Homes UK · Barclays GBP"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={fieldLabelClass}>Type</label>
                <select value={srcKind} onChange={(e) => setSrcKind(e.target.value as (typeof SOURCE_KINDS)[number])} className={inputClass}>
                  {SOURCE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={fieldLabelClass}>Last four digits</label>
                <input
                  value={srcLastFour}
                  onChange={(e) => setSrcLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="1234"
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={fieldLabelClass}>Bank or card issuer</label>
                <input value={srcInstitution} onChange={(e) => setSrcInstitution(e.target.value)} placeholder="Barclays" className={inputClass} />
              </div>
              <div>
                <label className={fieldLabelClass}>Currency</label>
                <input value={srcCurrency} onChange={(e) => setSrcCurrency(e.target.value)} placeholder="GBP" className={inputClass} />
              </div>
            </div>
            <div>
              <label className={fieldLabelClass}>Legal entity</label>
              <input
                value={srcEntity}
                onChange={(e) => setSrcEntity(e.target.value)}
                placeholder="One Homes UK Marketing Ltd"
                className={inputClass}
              />
            </div>
            {sourceError && <p className="text-xs text-status-inactive">{sourceError}</p>}
            <div className="flex gap-2">
              <button
                onClick={saveSource}
                disabled={savingSource || !srcName.trim()}
                className="rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
              >
                {editingSource ? "Save changes" : "Add account or card"}
              </button>
              {editingSourceId && (
                <button
                  onClick={() => setEditingSourceId(null)}
                  className="rounded-lg border border-base-700 px-3 py-1.5 text-xs text-ink-300 hover:border-base-600"
                >
                  Cancel editing
                </button>
              )}
            </div>
          </div>
        </WidgetCard>

        <WidgetCard title="Subscription and service register">
          <p className="mb-3 text-[11px] text-ink-500">
            Create separate records for Microsoft 365, Azure, HubSpot, Adobe or any other service. Assign owners and
            individual users.
          </p>
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={fieldLabelClass}>Supplier</label>
                <input value={subSupplier} onChange={(e) => setSubSupplier(e.target.value)} placeholder="Microsoft" className={inputClass} />
              </div>
              <div>
                <label className={fieldLabelClass}>Product/service</label>
                <input value={subService} onChange={(e) => setSubService(e.target.value)} placeholder="Microsoft 365 E3" className={inputClass} />
              </div>
            </div>
            <div>
              <label className={fieldLabelClass}>Why is it needed?</label>
              <input
                value={subPurpose}
                onChange={(e) => setSubPurpose(e.target.value)}
                placeholder="Office productivity licences for UK sales"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={fieldLabelClass}>Business owner</label>
                <input value={subOwner} onChange={(e) => setSubOwner(e.target.value)} placeholder="IT / Department head" className={inputClass} />
              </div>
              <div>
                <label className={fieldLabelClass}>Billing cycle</label>
                <select value={subCycle} onChange={(e) => setSubCycle(e.target.value)} className={inputClass}>
                  {BILLING_CYCLES.map((b) => (
                    <option key={b} value={b}>
                      {b || "Not set"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={fieldLabelClass}>Expected amount</label>
                <input value={subAmount} onChange={(e) => setSubAmount(e.target.value)} type="number" step="any" className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className={fieldLabelClass}>Currency</label>
                <input value={subCurrency} onChange={(e) => setSubCurrency(e.target.value)} placeholder="USD" className={inputClass} />
              </div>
              <div>
                <label className={fieldLabelClass}>Licences/seats</label>
                <input value={subSeats} onChange={(e) => setSubSeats(e.target.value)} type="number" min="0" className={inputClass} />
              </div>
              <div>
                <label className={fieldLabelClass}>Department</label>
                <select value={subDept} onChange={(e) => setSubDept(e.target.value)} className={inputClass}>
                  <option value="">Unassigned</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={fieldLabelClass}>Cost head</label>
                <select value={subCostHead} onChange={(e) => setSubCostHead(e.target.value)} className={inputClass}>
                  <option value="">Not mapped</option>
                  {costHeads.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={fieldLabelClass}>Vendor subscription/invoice ID</label>
              <input value={subVendorRef} onChange={(e) => setSubVendorRef(e.target.value)} className={inputClass} />
            </div>

            <div className="rounded-lg border border-base-700 p-3">
              <p className="text-xs font-medium text-ink-50">Email licences &amp; department ownership</p>
              <p className="mt-1 text-[10px] text-ink-500">
                Record each email&apos;s bundle (for example M365 or M365 + Copilot), owning department and actual
                licence cost in the subscription&apos;s currency. If any account has a price, all must have prices (0
                for genuinely free seats). The total supplier payment is split in proportion to the prices, with
                cents reconciled exactly. Historical approved splits stay frozen.
              </p>
              <div className="mt-2 space-y-2">
                {subLicenceRows.map((u, idx) => (
                  <div key={idx} className="grid grid-cols-5 gap-1.5">
                    <input
                      value={u.email}
                      onChange={(e) =>
                        setSubLicenceRows((prev) => prev.map((r, i) => (i === idx ? { ...r, email: e.target.value } : r)))
                      }
                      placeholder="Email"
                      className={`${inputClass} col-span-2`}
                    />
                    <select
                      value={u.team}
                      onChange={(e) =>
                        setSubLicenceRows((prev) => prev.map((r, i) => (i === idx ? { ...r, team: e.target.value } : r)))
                      }
                      className={inputClass}
                    >
                      <option value="">Department</option>
                      {departments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <input
                      value={u.licenceType}
                      onChange={(e) =>
                        setSubLicenceRows((prev) => prev.map((r, i) => (i === idx ? { ...r, licenceType: e.target.value } : r)))
                      }
                      placeholder="Licence type"
                      className={inputClass}
                    />
                    <input
                      value={u.licenceCost}
                      onChange={(e) =>
                        setSubLicenceRows((prev) => prev.map((r, i) => (i === idx ? { ...r, licenceCost: e.target.value } : r)))
                      }
                      placeholder="Cost"
                      type="number"
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSubLicenceRows((prev) => [...prev, emptyUserDraft()])}
                className="mt-2 flex items-center gap-1 rounded-md border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600"
              >
                <Plus className="h-3 w-3" /> Add email licence
              </button>
            </div>

            <div>
              <label className={fieldLabelClass}>Notes</label>
              <textarea value={subNotes} onChange={(e) => setSubNotes(e.target.value)} rows={2} className={inputClass} />
            </div>

            {subError && <p className="text-xs text-status-inactive">{subError}</p>}
            <div className="flex gap-2">
              <button
                onClick={saveSubscription}
                disabled={savingSub || !subSupplier.trim() || !subService.trim()}
                className="rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
              >
                {editingSub ? "Update subscription" : "Add subscription"}
              </button>
              {editingSubId && (
                <button
                  onClick={() => setEditingSubId(null)}
                  className="rounded-lg border border-base-700 px-3 py-1.5 text-xs text-ink-300 hover:border-base-600"
                >
                  Cancel editing
                </button>
              )}
            </div>
          </div>
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard title={`Registered company accounts & cards · ${sources.length} records`}>
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Institution / entity</th>
                  <th className="px-3 py-2">Identifier</th>
                  <th className="px-3 py-2">Payments</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="px-3 py-2 font-medium text-ink-50">{s.name}</td>
                    <td className="px-3 py-2">{s.kind}</td>
                    <td className="px-3 py-2">
                      {s.institution ?? "—"}
                      <div className="text-[11px] text-ink-500">{s.legalEntity ?? ""} / {s.currency ?? "Currency unknown"}</div>
                    </td>
                    <td className="px-3 py-2">{s.lastFour ? `•••• ${s.lastFour}` : "Not provided"}</td>
                    <td className="px-3 py-2">{transactions.filter((t) => t.paymentSourceId === s.id).length}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => startEditSource(s)}
                          className="rounded-md border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setSourceFilterId(s.id);
                            setSubFilterId(null);
                            setTraceSearch("");
                          }}
                          className="rounded-md border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50"
                        >
                          Payments
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {sources.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-ink-500">
                      Register your company accounts and cards above before classifying payments.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </WidgetCard>
      </div>

      {selectedSub && (
        <div className="mt-4">
          <WidgetCard
            title={`Shared subscription allocation · ${selectedSub.service}`}
            icon={Calculator}
            action={
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-[11px] text-ink-500">
                  <input type="checkbox" checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)} />
                  Replace existing approvals
                </label>
                <button
                  onClick={() => setSelectedSubId(null)}
                  className="rounded-md border border-base-700 px-2.5 py-1 text-[11px] text-ink-300 hover:border-base-600"
                >
                  Close
                </button>
              </div>
            }
          >
            {previewLoading && <p className="text-xs text-ink-500">Calculating…</p>}
            {previewError && <p className="mb-2 text-xs text-status-inactive">{previewError}</p>}
            {approveMessage && (
              <p className="mb-2 flex items-center gap-1 text-xs text-status-active">
                <CheckCircle2 className="h-3.5 w-3.5" /> {approveMessage}
              </p>
            )}
            {preview && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Kpi title="Named licences" value={String(preview.licences)} detail="All must be tagged" />
                  <Kpi
                    title="Linked operating payments"
                    value={preview.eligiblePayments.toLocaleString()}
                    detail={`${preview.alreadyApproved} previously approved`}
                  />
                  <Kpi title="Payments total" value={formatUsd(preview.totalUsd)} detail="One original transaction per supplier charge" />
                  <Kpi
                    title="Allocation method"
                    value={preview.allocationMethod === "price-weighted" ? "Price-weighted" : "Equal-seat"}
                    detail={preview.licenceCurrency}
                  />
                </div>
                <div className="overflow-x-auto rounded-xl border border-base-700">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                      <tr>
                        <th className="px-3 py-2">Department</th>
                        <th className="px-3 py-2">Licences</th>
                        <th className="px-3 py-2">Share</th>
                        <th className="px-3 py-2">Total USD across selected payments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(preview.departmentTotals)
                        .sort()
                        .map((dept) => (
                          <tr key={dept} className="border-b border-base-800 text-ink-300 last:border-0">
                            <td className="px-3 py-2 font-medium text-ink-50">{dept}</td>
                            <td className="px-3 py-2">{preview.seatCounts[dept] ?? 0}</td>
                            <td className="px-3 py-2">{formatUsd(preview.seatWeights[dept] ?? 0)}</td>
                            <td className="px-3 py-2">{formatUsd(preview.departmentTotals[dept])}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-ink-500">
                  Approved months remain frozen until Finance deliberately replaces an approval. Slices are computed
                  in integer cents with largest-remainder apportionment, so they always sum back exactly to the
                  payment amount.
                </p>
                <button
                  onClick={approveSplit}
                  disabled={approving}
                  className="rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
                >
                  {approving ? "Approving…" : `Approve cost allocation for ${preview.eligiblePayments} payment(s)`}
                </button>
              </div>
            )}
          </WidgetCard>
        </div>
      )}

      <div className="mt-4">
        <WidgetCard title={`What recurring subscriptions are we actually paying for? · ${subscriptions.length} records`}>
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Supplier / product</th>
                  <th className="px-3 py-2">Purpose / owner</th>
                  <th className="px-3 py-2">Users</th>
                  <th className="px-3 py-2">Linked spend</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s) => {
                  const users = subscriptionUsers.filter((u) => u.subscriptionId === s.id);
                  const linked = transactions.filter((t) => t.subscriptionId === s.id);
                  const linkedTotal = linked.reduce((sum, t) => sum + t.amount, 0);
                  return (
                    <tr key={s.id} className="border-b border-base-800 text-ink-300 last:border-0">
                      <td className="px-3 py-2">
                        <p className="font-medium text-ink-50">{s.supplier}</p>
                        <p className="text-[11px] text-ink-500">{s.service}</p>
                      </td>
                      <td className="px-3 py-2">
                        {s.purpose || "Purpose not confirmed"}
                        <div className="text-[11px] text-ink-500">Owner: {s.owner || "Unassigned"}</div>
                      </td>
                      <td className="px-3 py-2">
                        {users.length} named users
                        <div className="text-[11px] text-ink-500">{users.slice(0, 3).map((u) => u.userEmail).join(", ") || "None mapped"}</div>
                      </td>
                      <td className="px-3 py-2">
                        {formatUsd(linkedTotal)}
                        <div className="text-[11px] text-ink-500">{linked.length} payments</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => startEditSub(s)}
                            className="rounded-md border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setSubFilterId(s.id);
                              setSourceFilterId(null);
                              setTraceSearch("");
                            }}
                            className="rounded-md border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50"
                          >
                            Payments
                          </button>
                          <button
                            onClick={() => calculateSplit(s)}
                            className="rounded-md border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50"
                          >
                            Allocate costs
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {subscriptions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-ink-500">
                      No subscriptions registered. Add them above, then link specific payments.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard title={`Find payments to investigate · ${searchResults.length} matching`}>
          <p className="mb-2 text-[11px] text-ink-500">
            Click a payment to enter bank reference, account/card, exact service and responsible user. Use All
            Payments to select multiple rows and attach them to an existing subscription.
          </p>
          {(sourceFilterId || subFilterId) && (
            <div className="mb-2">
              <button
                onClick={() => {
                  setSourceFilterId(null);
                  setSubFilterId(null);
                }}
                className="rounded-full border border-base-700 px-2.5 py-1 text-[11px] text-ink-300 hover:border-base-600"
              >
                Filtered by {sourceFilterId ? sources.find((s) => s.id === sourceFilterId)?.name : subscriptions.find((s) => s.id === subFilterId)?.service} ×
              </button>
            </div>
          )}
          <div className="mb-3 flex gap-2">
            <input
              value={traceSearch}
              onChange={(e) => setTraceSearch(e.target.value)}
              placeholder="Search Microsoft, bank reference, invoice..."
              className={`${inputClass} max-w-md`}
            />
          </div>
          <PaymentsTable rows={cappedResults} onRowClick={openTraceEditor} />
          {searchResults.length > 300 && (
            <p className="mt-2 text-[11px] text-ink-500">Showing the first 300 matches, narrow your search to see more.</p>
          )}
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard title="Incoming ERP records awaiting reconciliation" icon={Network} action={<span className="text-[11px] text-ink-500">{state.unmatchedErpRecords} unmatched</span>}>
          <p className="mb-2 text-[11px] text-ink-500">
            ERP records are held for safe matching against bank/ledger payments. Nothing is automatically posted to
            cost heads or used to overwrite manual classifications.
          </p>
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">ERP payment ID</th>
                  <th className="px-3 py-2">Supplier</th>
                  <th className="px-3 py-2">Bank / invoice reference</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {erpRecordsParsed.map((r) => (
                  <tr key={r.id} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="px-3 py-2">{r.externalId}</td>
                    <td className="px-3 py-2">{r.parsed.supplier || "Not supplied"}</td>
                    <td className="px-3 py-2">
                      {r.parsed.bankReference || ""}
                      <div className="text-[11px] text-ink-500">{r.parsed.invoiceReference || ""}</div>
                    </td>
                    <td className="px-3 py-2">
                      {erpMatchTargetId === r.id ? (
                        <p className="text-[11px] text-ink-500">Click a row in &quot;Find payments to investigate&quot; above to link it.</p>
                      ) : (
                        <button
                          onClick={() => {
                            setErpMatchTargetId(r.id);
                            setTraceSearch(r.parsed.supplier || r.parsed.bankReference || "");
                            setSourceFilterId(null);
                            setSubFilterId(null);
                          }}
                          className="rounded-md border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50"
                        >
                          Find matching ledger payment
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {erpRecordsParsed.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-ink-500">
                      No incoming ERP records. A connector must be configured before the ERP can send data.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard title="ERP and Microsoft login connections">
          <div className="rounded-lg border border-tier-gold/30 bg-tier-gold/10 p-3 text-xs text-tier-gold">
            <strong>Connection setup required.</strong> The ERP integration cannot be activated until your ERP name,
            API documentation and credentials are provided. Microsoft sign-in requires a One Homes Entra app
            registration and an approved access group/app role. Until then this application remains local-only, it
            is not a secured multi-user service.
          </div>
          <p className="mt-2 text-[11px] text-ink-500">
            The local SQL database is ready to store ERP payment IDs, bank references, invoice numbers, funding
            instruments and subscription mappings. See the integration guide supplied with this update.
          </p>
        </WidgetCard>
      </div>

      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl border border-base-700 bg-base-900 p-5">
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-sm font-medium text-ink-50">{editingTx.description}</h2>
              <button onClick={() => setEditingTx(null)} className="text-ink-500 hover:text-ink-300">
                ✕
              </button>
            </div>
            <p className="mb-4 text-[11px] text-ink-500">Payment ID {editingTx.id}</p>
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={fieldLabelClass}>Bank/card transaction reference</label>
                  <input
                    value={traceForm.paymentReference}
                    onChange={(e) => setTraceForm((f) => ({ ...f, paymentReference: e.target.value }))}
                    placeholder="Exact statement reference"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={fieldLabelClass}>ERP payment ID</label>
                  <input
                    value={traceForm.erpPaymentId}
                    onChange={(e) => setTraceForm((f) => ({ ...f, erpPaymentId: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={fieldLabelClass}>Invoice / receipt reference</label>
                  <input
                    value={traceForm.invoiceReference}
                    onChange={(e) => setTraceForm((f) => ({ ...f, invoiceReference: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={fieldLabelClass}>Paid by</label>
                  <select
                    value={traceForm.paymentMethod}
                    onChange={(e) => setTraceForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                    className={inputClass}
                  >
                    {["Unknown", "Bank transfer", "Company card", "Other"].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={fieldLabelClass}>Company account or card</label>
                <select
                  value={traceForm.paymentSourceId}
                  onChange={(e) => setTraceForm((f) => ({ ...f, paymentSourceId: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">Not identified</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.kind}
                      {s.lastFour ? ` · ${s.lastFour}` : ""})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={fieldLabelClass}>Supplier or merchant</label>
                <input
                  value={traceForm.supplier}
                  onChange={(e) => setTraceForm((f) => ({ ...f, supplier: e.target.value }))}
                  placeholder="e.g. Microsoft Ireland"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={fieldLabelClass}>Subscription or recurring contract</label>
                <select
                  value={traceForm.subscriptionId}
                  onChange={(e) => setTraceForm((f) => ({ ...f, subscriptionId: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">No identified subscription</option>
                  {subscriptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.supplier} / {s.service}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={fieldLabelClass}>What exactly was bought or who uses it?</label>
                <textarea
                  value={traceForm.purpose}
                  onChange={(e) => setTraceForm((f) => ({ ...f, purpose: e.target.value }))}
                  rows={2}
                  placeholder="e.g. 25 Microsoft 365 E3 licences used by Sales"
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={fieldLabelClass}>Original payment currency</label>
                  <input
                    value={traceForm.sourceCurrency}
                    onChange={(e) => setTraceForm((f) => ({ ...f, sourceCurrency: e.target.value }))}
                    placeholder="GBP"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={fieldLabelClass}>Original payment amount</label>
                  <input
                    value={traceForm.sourceAmount}
                    onChange={(e) => setTraceForm((f) => ({ ...f, sourceAmount: e.target.value }))}
                    type="number"
                    step="any"
                    placeholder="If known"
                    className={inputClass}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-[11px] text-ink-300">
                <input
                  type="checkbox"
                  checked={traceForm.traceReviewed}
                  onChange={(e) => setTraceForm((f) => ({ ...f, traceReviewed: e.target.checked }))}
                />
                Payment reference, source and purpose verified against supporting evidence
              </label>
              {traceError && <p className="text-xs text-status-inactive">{traceError}</p>}
              <div className="flex items-center justify-between pt-2">
                {erpMatchTargetId ? (
                  <button
                    onClick={() => linkErpToTransaction(erpMatchTargetId, editingTx.id)}
                    disabled={matchingErp}
                    className="rounded-lg border border-tier-gold/40 px-3 py-1.5 text-xs text-tier-gold hover:bg-tier-gold/10 disabled:opacity-50"
                  >
                    Link this ERP record to this payment
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <button onClick={() => setEditingTx(null)} className="rounded-lg border border-base-700 px-3 py-1.5 text-xs text-ink-300 hover:border-base-600">
                    Cancel
                  </button>
                  <button
                    onClick={saveTrace}
                    disabled={savingTrace}
                    className="rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
                  >
                    {savingTrace ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
