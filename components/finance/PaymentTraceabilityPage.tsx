"use client";

import { useMemo, useState } from "react";
import { Landmark, Link2, Repeat, Network, Plus, X, Calculator, CheckCircle2 } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

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

type TraceState = {
  paymentSources: PaymentSource[];
  subscriptions: Subscription[];
  subscriptionUsers: SubscriptionUser[];
  paymentsWithBankReference: number;
  unmatchedErpRecords: number;
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
const STATUSES = ["Active", "Cancelled", "Paused"];

function formatUsd(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-base-700 bg-base-800 p-3">
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink-50">{value}</p>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500";

function PaymentSourceModal({ onClose, onSaved }: { onClose: () => void; onSaved: (s: PaymentSource) => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<(typeof SOURCE_KINDS)[number]>("Bank account");
  const [lastFour, setLastFour] = useState("");
  const [legalEntity, setLegalEntity] = useState("");
  const [institution, setInstitution] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/trace/payment-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind, lastFour, legalEntity, institution, currency, note }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to save payment source");
      onSaved({
        id: data.id,
        name,
        kind,
        legalEntity: legalEntity || null,
        institution: institution || null,
        currency: currency || null,
        lastFour: lastFour || null,
        note: note || null,
        isActive: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-50">New Payment Source</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className={inputClass} />
          <select value={kind} onChange={(e) => setKind(e.target.value as (typeof SOURCE_KINDS)[number])} className={inputClass}>
            {SOURCE_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              value={lastFour}
              onChange={(e) => setLastFour(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="Last 4 digits"
              className={inputClass}
            />
            <input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="Currency" className={inputClass} />
          </div>
          <p className="text-[10px] text-ink-600">Never enter full bank or card details — last four digits only.</p>
          <input
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="Institution (e.g. Emirates NBD)"
            className={inputClass}
          />
          <input
            value={legalEntity}
            onChange={(e) => setLegalEntity(e.target.value)}
            placeholder="Legal entity (optional)"
            className={inputClass}
          />
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className={inputClass} rows={2} />
          {error && <p className="text-xs text-status-inactive">{error}</p>}
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Create source"}
          </button>
        </form>
      </div>
    </div>
  );
}

type UserDraft = {
  email: string;
  name: string;
  team: string;
  licenceType: string;
  licenceCost: string;
  licenceQuantity: string;
};

function emptyUserDraft(): UserDraft {
  return { email: "", name: "", team: "", licenceType: "", licenceCost: "", licenceQuantity: "1" };
}

function SubscriptionModal({
  departments,
  costHeads,
  subscription,
  users,
  onClose,
  onSaved,
}: {
  departments: string[];
  costHeads: string[];
  subscription: Subscription | null;
  users: SubscriptionUser[];
  onClose: () => void;
  onSaved: (sub: Subscription, users: UserDraft[]) => void;
}) {
  const [supplier, setSupplier] = useState(subscription?.supplier ?? "");
  const [service, setService] = useState(subscription?.service ?? "");
  const [department, setDepartment] = useState(subscription?.department ?? "");
  const [costHead, setCostHead] = useState(subscription?.costHead ?? "");
  const [owner, setOwner] = useState(subscription?.owner ?? "");
  const [billingCycle, setBillingCycle] = useState(subscription?.billingCycle ?? "Monthly");
  const [expectedAmount, setExpectedAmount] = useState(subscription?.expectedAmount?.toString() ?? "");
  const [currency, setCurrency] = useState(subscription?.currency ?? "USD");
  const [status, setStatus] = useState(subscription?.status ?? "Active");
  const [vendorReference, setVendorReference] = useState(subscription?.vendorReference ?? "");
  const [notes, setNotes] = useState(subscription?.notes ?? "");
  const [userDrafts, setUserDrafts] = useState<UserDraft[]>(
    users.length
      ? users.map((u) => ({
          email: u.userEmail,
          name: u.userName ?? "",
          team: u.team ?? "",
          licenceType: u.licenceType ?? "",
          licenceCost: u.licenceCost !== null ? String(u.licenceCost) : "",
          licenceQuantity: String(u.licenceQuantity ?? 1),
        }))
      : [emptyUserDraft()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateUser(idx: number, patch: Partial<UserDraft>) {
    setUserDrafts((prev) => prev.map((u, i) => (i === idx ? { ...u, ...patch } : u)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const cleanUsers = userDrafts
        .filter((u) => u.email.trim())
        .map((u) => ({
          email: u.email.trim(),
          name: u.name.trim() || undefined,
          team: u.team.trim() || undefined,
          licenceType: u.licenceType.trim() || undefined,
          licenceCost: u.licenceCost.trim() === "" ? null : Number(u.licenceCost),
          licenceQuantity: u.licenceQuantity.trim() === "" ? 1 : Number(u.licenceQuantity),
        }));
      const res = await fetch("/api/finance/trace/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: subscription?.id,
          supplier,
          service,
          department: department || undefined,
          costHead: costHead || undefined,
          owner: owner || undefined,
          billingCycle: billingCycle || undefined,
          expectedAmount: expectedAmount.trim() === "" ? null : Number(expectedAmount),
          currency: currency || undefined,
          status,
          vendorReference: vendorReference || undefined,
          notes: notes || undefined,
          users: cleanUsers,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to save subscription");
      onSaved(
        {
          id: data.id,
          supplier,
          service,
          purpose: subscription?.purpose ?? null,
          department: department || null,
          costHead: costHead || null,
          owner: owner || null,
          billingCycle: billingCycle || null,
          expectedAmount: expectedAmount.trim() === "" ? null : Number(expectedAmount),
          currency: currency || null,
          renewalDate: subscription?.renewalDate ?? null,
          status,
          vendorReference: vendorReference || null,
          licenceCount: cleanUsers.length,
          notes: notes || null,
        },
        userDrafts.filter((u) => u.email.trim())
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-50">{subscription ? "Edit Subscription" : "New Subscription"}</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Supplier" className={inputClass} />
            <input value={service} onChange={(e) => setService(e.target.value)} placeholder="Service / product" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass}>
              <option value="">Owning department (optional)</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select value={costHead} onChange={(e) => setCostHead(e.target.value)} className={inputClass}>
              <option value="">Cost head</option>
              {costHeads.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select value={billingCycle} onChange={(e) => setBillingCycle(e.target.value)} className={inputClass}>
              {BILLING_CYCLES.filter(Boolean).map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <input
              value={expectedAmount}
              onChange={(e) => setExpectedAmount(e.target.value)}
              placeholder="Expected amount"
              type="number"
              className={inputClass}
            />
            <input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="Currency" className={inputClass} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Owner" className={inputClass} />
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              value={vendorReference}
              onChange={(e) => setVendorReference(e.target.value)}
              placeholder="Vendor reference"
              className={inputClass}
            />
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className={inputClass} rows={2} />

          <div className="rounded-lg border border-base-700 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-ink-50">Named licence users</p>
              <button
                type="button"
                onClick={() => setUserDrafts((prev) => [...prev, emptyUserDraft()])}
                className="flex items-center gap-1 rounded-md border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600"
              >
                <Plus className="h-3 w-3" /> Add user
              </button>
            </div>
            <p className="mb-2 text-[10px] text-ink-600">
              Price every licence (0 for free) to use a price-weighted split, or leave all prices blank for an equal-seat split.
            </p>
            <div className="space-y-2">
              {userDrafts.map((u, idx) => (
                <div key={idx} className="grid grid-cols-6 gap-1.5">
                  <input
                    value={u.email}
                    onChange={(e) => updateUser(idx, { email: e.target.value })}
                    placeholder="Email"
                    className={`${inputClass} col-span-2`}
                  />
                  <select value={u.team} onChange={(e) => updateUser(idx, { team: e.target.value })} className={inputClass}>
                    <option value="">Department</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <input
                    value={u.licenceType}
                    onChange={(e) => updateUser(idx, { licenceType: e.target.value })}
                    placeholder="Licence type"
                    className={inputClass}
                  />
                  <input
                    value={u.licenceCost}
                    onChange={(e) => updateUser(idx, { licenceCost: e.target.value })}
                    placeholder="Cost"
                    type="number"
                    className={inputClass}
                  />
                  <div className="flex gap-1">
                    <input
                      value={u.licenceQuantity}
                      onChange={(e) => updateUser(idx, { licenceQuantity: e.target.value })}
                      placeholder="Qty"
                      type="number"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => setUserDrafts((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-ink-500 hover:text-status-inactive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-status-inactive">{error}</p>}
          <button
            type="submit"
            disabled={saving || !supplier.trim() || !service.trim()}
            className="w-full rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save subscription"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function PaymentTraceabilityPage({
  state,
  departments,
  costHeads,
}: {
  state: TraceState;
  departments: string[];
  costHeads: string[];
}) {
  const [sources, setSources] = useState(state.paymentSources);
  const [subscriptions, setSubscriptions] = useState(state.subscriptions);
  const [subscriptionUsers, setSubscriptionUsers] = useState(state.subscriptionUsers);
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [subModal, setSubModal] = useState<Subscription | "new" | null>(null);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(subscriptions[0]?.id ?? null);

  const [preview, setPreview] = useState<SplitPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveMessage, setApproveMessage] = useState<string | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);

  const selectedSub = subscriptions.find((s) => s.id === selectedSubId) ?? null;
  const usersForSelected = useMemo(
    () => subscriptionUsers.filter((u) => u.subscriptionId === selectedSubId),
    [subscriptionUsers, selectedSubId]
  );

  function handleSourceSaved(s: PaymentSource) {
    setSources((prev) => [...prev, s].sort((a, b) => a.name.localeCompare(b.name)));
    setSourceModalOpen(false);
  }

  function handleSubSaved(sub: Subscription, users: UserDraft[]) {
    setSubscriptions((prev) => {
      const exists = prev.some((s) => s.id === sub.id);
      return exists ? prev.map((s) => (s.id === sub.id ? sub : s)) : [...prev, sub];
    });
    setSubscriptionUsers((prev) => [
      ...prev.filter((u) => u.subscriptionId !== sub.id),
      ...users.map((u, i) => ({
        id: `${sub.id}-${i}`,
        subscriptionId: sub.id,
        userEmail: u.email,
        userName: u.name || null,
        team: u.team || null,
        licenceType: u.licenceType || null,
        licenceCost: u.licenceCost.trim() === "" ? null : Number(u.licenceCost),
        licenceQuantity: u.licenceQuantity.trim() === "" ? 1 : Number(u.licenceQuantity),
      })),
    ]);
    setSelectedSubId(sub.id);
    setSubModal(null);
    setPreview(null);
  }

  async function calculateSplit() {
    if (!selectedSub || previewLoading) return;
    setPreviewLoading(true);
    setPreviewError(null);
    setApproveMessage(null);
    try {
      const res = await fetch("/api/finance/trace/subscription/split-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: selectedSub.id, replaceExisting }),
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
      setApproveMessage(`Approved — ${data.approvedPayments ?? 0} payment(s) split across ${Object.keys(data.departmentTotals ?? {}).length} department(s).`);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Failed");
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Payment Traceability</h1>
          <p className="mt-1 text-sm text-ink-500">Bank/card sources, shared subscriptions, and penny-exact cost splits.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <WidgetCard title="Payment Sources" icon={Landmark}>
          <Tile label="Registered accounts/cards" value={sources.length.toLocaleString()} />
        </WidgetCard>
        <WidgetCard title="Subscriptions" icon={Repeat}>
          <Tile label="Tracked suppliers/services" value={subscriptions.length.toLocaleString()} />
        </WidgetCard>
        <WidgetCard title="Traced Payments" icon={Link2}>
          <Tile label="With a payment reference" value={state.paymentsWithBankReference.toLocaleString()} />
        </WidgetCard>
        <WidgetCard title="Unmatched ERP Records" icon={Network}>
          <Tile label="Pending ERP sync staging" value={state.unmatchedErpRecords.toLocaleString()} />
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard
          title="Payment Sources"
          icon={Landmark}
          action={
            <button
              onClick={() => setSourceModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-2.5 py-1 text-[11px] font-medium text-base-950 hover:bg-white"
            >
              <Plus className="h-3 w-3" /> Add source
            </button>
          }
        >
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Kind</th>
                  <th className="px-3 py-2">Institution</th>
                  <th className="px-3 py-2">Last 4</th>
                  <th className="px-3 py-2">Currency</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="px-3 py-2 font-medium text-ink-50">{s.name}</td>
                    <td className="px-3 py-2">{s.kind}</td>
                    <td className="px-3 py-2">{s.institution ?? "—"}</td>
                    <td className="px-3 py-2">{s.lastFour ? `••${s.lastFour}` : "—"}</td>
                    <td className="px-3 py-2">{s.currency ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          s.isActive ? "bg-status-active/15 text-status-active" : "bg-status-inactive/15 text-status-inactive"
                        }`}
                      >
                        {s.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
                {sources.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-ink-500">
                      No payment sources registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </WidgetCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WidgetCard
          title="Subscriptions"
          icon={Repeat}
          action={
            <button
              onClick={() => setSubModal("new")}
              className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-2.5 py-1 text-[11px] font-medium text-base-950 hover:bg-white"
            >
              <Plus className="h-3 w-3" /> Add subscription
            </button>
          }
        >
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Supplier / Service</th>
                  <th className="px-3 py-2">Dept</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => {
                      setSelectedSubId(s.id);
                      setPreview(null);
                      setApproveMessage(null);
                      setPreviewError(null);
                    }}
                    className={`cursor-pointer border-b border-base-800 text-ink-300 last:border-0 hover:bg-base-800/60 ${
                      selectedSubId === s.id ? "bg-base-800/60" : ""
                    }`}
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium text-ink-50">{s.supplier}</p>
                      <p className="text-[11px] text-ink-500">{s.service}</p>
                    </td>
                    <td className="px-3 py-2">{s.department ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-status-active/15 px-2 py-0.5 text-[11px] font-medium text-status-active">
                        {s.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSubModal(s);
                        }}
                        className="rounded-md border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
                {subscriptions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-ink-500">
                      No subscriptions tracked yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </WidgetCard>

        <WidgetCard title={selectedSub ? `Named Licences · ${selectedSub.service}` : "Named Licences"} icon={Repeat}>
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Dept</th>
                  <th className="px-3 py-2">Cost</th>
                  <th className="px-3 py-2">Qty</th>
                </tr>
              </thead>
              <tbody>
                {usersForSelected.map((u) => (
                  <tr key={u.id} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="max-w-[160px] truncate px-3 py-2" title={u.userEmail}>
                      {u.userEmail}
                    </td>
                    <td className="px-3 py-2">{u.team ?? "—"}</td>
                    <td className="px-3 py-2">{u.licenceCost !== null ? formatUsd(u.licenceCost) : "—"}</td>
                    <td className="px-3 py-2">{u.licenceQuantity ?? 1}</td>
                  </tr>
                ))}
                {usersForSelected.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-ink-500">
                      {selectedSub ? "No named licences on this subscription yet." : "Select a subscription."}
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
            title={`Shared-Cost Split · ${selectedSub.supplier} / ${selectedSub.service}`}
            icon={Calculator}
            action={
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-[11px] text-ink-500">
                  <input type="checkbox" checked={replaceExisting} onChange={(e) => setReplaceExisting(e.target.checked)} />
                  Replace existing approvals
                </label>
                <button
                  onClick={calculateSplit}
                  disabled={previewLoading}
                  className="rounded-md border border-base-700 px-2.5 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50 disabled:opacity-50"
                >
                  {previewLoading ? "Calculating…" : "Calculate split"}
                </button>
              </div>
            }
          >
            {previewError && <p className="mb-2 text-xs text-status-inactive">{previewError}</p>}
            {approveMessage && (
              <p className="mb-2 flex items-center gap-1 text-xs text-status-active">
                <CheckCircle2 className="h-3.5 w-3.5" /> {approveMessage}
              </p>
            )}
            {!preview && !previewError && (
              <p className="text-xs text-ink-500">
                Calculate a split to see the penny-exact per-department breakdown before approving it.
              </p>
            )}
            {preview && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Tile label="Allocation method" value={preview.allocationMethod === "price-weighted" ? "Price-weighted" : "Equal-seat"} />
                  <Tile label="Eligible payments" value={preview.eligiblePayments.toLocaleString()} />
                  <Tile label="Already approved" value={preview.alreadyApproved.toLocaleString()} />
                  <Tile label="Total linked spend" value={formatUsd(preview.totalUsd)} />
                </div>

                <div>
                  <p className="mb-1 text-[11px] font-medium text-ink-500">Department totals (across {preview.eligiblePayments} eligible payments)</p>
                  <div className="overflow-x-auto rounded-xl border border-base-700">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                        <tr>
                          <th className="px-3 py-2">Department</th>
                          <th className="px-3 py-2">Seats</th>
                          <th className="px-3 py-2">Licence weight</th>
                          <th className="px-3 py-2">Total allocated</th>
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
                </div>

                <div>
                  <p className="mb-1 text-[11px] font-medium text-ink-500">
                    Sample payment slice · {preview.samplePayment.month} · {formatUsd(preview.samplePayment.amountUsd)}
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-base-700">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                        <tr>
                          <th className="px-3 py-2">Department</th>
                          <th className="px-3 py-2">Cost head</th>
                          <th className="px-3 py-2">Licences</th>
                          <th className="px-3 py-2">Slice amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.samplePayment.slices.map((slice) => (
                          <tr key={slice.department} className="border-b border-base-800 text-ink-300 last:border-0">
                            <td className="px-3 py-2 font-medium text-ink-50">{slice.department}</td>
                            <td className="px-3 py-2">{slice.costHead}</td>
                            <td className="px-3 py-2">{slice.licences}</td>
                            <td className="px-3 py-2">{formatUsd(slice.amountUsd)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-1 text-[10px] text-ink-600">
                    Slices are computed in integer cents with largest-remainder apportionment, so they always sum back exactly to the
                    payment amount.
                  </p>
                </div>

                <button
                  onClick={approveSplit}
                  disabled={approving}
                  className="rounded-lg bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
                >
                  {approving ? "Approving…" : "Approve split"}
                </button>
              </div>
            )}
          </WidgetCard>
        </div>
      )}

      {sourceModalOpen && <PaymentSourceModal onClose={() => setSourceModalOpen(false)} onSaved={handleSourceSaved} />}
      {subModal && (
        <SubscriptionModal
          departments={departments}
          costHeads={costHeads}
          subscription={subModal === "new" ? null : subModal}
          users={subModal === "new" ? [] : subscriptionUsers.filter((u) => u.subscriptionId === (subModal as Subscription).id)}
          onClose={() => setSubModal(null)}
          onSaved={handleSubSaved}
        />
      )}
    </div>
  );
}
