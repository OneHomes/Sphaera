"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useFilteredFinanceRows, useFinanceFilters } from "./FinanceFilterContext";
import { useTablePager } from "./TablePager";
import { effectiveCentre, effectiveHead, mo, reportingRows } from "@/lib/finance/financeReporting";
import type { FinanceLedgerRow } from "@/lib/finance/ledgerData";

// Port of the source overheadPage().

type HeadRule = { costHead: string; costNature: string; costBehaviour: string; updatedAt: string | Date };
type Tag = { nature: string; behaviour: string; source: "Payment override" | "Cost-head rule" | "Not reviewed" };

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

// Source OH_RECOMMENDATIONS.
const RECOMMENDATIONS: Record<string, [string, string]> = {
  Salaries: ["overhead", "fixed"],
  "Rent & Facilities": ["overhead", "fixed"],
  Insurance: ["overhead", "fixed"],
  "Telephone & Internet": ["overhead", "mixed"],
  "Utilities & Maintenance": ["overhead", "mixed"],
  "Software & Subscriptions": ["overhead", "mixed"],
  "IT & Equipment": ["overhead", "mixed"],
  "Employer Payroll Taxes": ["overhead", "mixed"],
  "Staff Benefits & Pensions": ["overhead", "fixed"],
  "Office Administration": ["overhead", "mixed"],
  "Office Supplies": ["overhead", "variable"],
  "Professional & Legal Fees": ["overhead", "mixed"],
  "Licences & Permits": ["overhead", "fixed"],
  Security: ["overhead", "fixed"],
  "Bank Charges": ["overhead", "mixed"],
  "Bank & Merchant Charges": ["overhead", "mixed"],
  Commissions: ["overhead", "variable"],
  "Commissions Agent": ["overhead", "variable"],
  "Agency & Referral Fees": ["overhead", "variable"],
  "Bonuses & Incentives": ["overhead", "variable"],
  "Paid Marketing": ["overhead", "variable"],
  Advertising: ["overhead", "variable"],
  "Events & Exhibitions": ["overhead", "variable"],
  "Travel & Accommodation": ["overhead", "variable"],
  Recruitment: ["overhead", "oneoff"],
  "Training & Development": ["overhead", "oneoff"],
  Taxes: ["review", "na"],
  "Project Delivery": ["direct", "variable"],
  "Site Surveys & Technical Design": ["direct", "variable"],
  "Planning & Building Permits": ["direct", "oneoff"],
  Loans: ["balance", "na"],
  "Refund - Downpayment": ["balance", "na"],
  "Aqib personal Charge": ["review", "na"],
  "Resold Apartment": ["review", "na"],
};

function usd(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (compact && Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `${value < 0 ? "-" : ""}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

/** Mirrors lib/finance/peopleOverheadsData.ts's overheadPair() for client-side UX. */
function validatePair(nature: string, behaviour: string): string | null {
  if (!nature && !behaviour) return null;
  if (!nature) return "Choose a cost nature.";
  if (!behaviour) return "Choose a cost behaviour.";
  if ((nature === "balance" || nature === "review") && behaviour !== "na") {
    return "Balance-sheet or pending-review movements must use N/A behaviour.";
  }
  if (nature === "direct" && behaviour === "na") return "Direct costs require a real cost behaviour.";
  return null;
}

const selectSm = "rounded-md border border-base-700 bg-base-800 px-1.5 py-1 text-[11px] text-ink-50 outline-none disabled:opacity-40";

function Kpi({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <h4 className="text-[11px] text-ink-500">{title}</h4>
      <div className="mt-1 text-xl font-semibold text-ink-50">{value}</div>
      <div className="mt-1 text-[11px] text-ink-500">{detail}</div>
    </div>
  );
}

function RuleEditor({
  costHead,
  nature,
  behaviour,
  canEdit,
  onSaved,
}: {
  costHead: string;
  nature: string;
  behaviour: string;
  canEdit: boolean;
  onSaved: (costHead: string, nature: string, behaviour: string) => void;
}) {
  const [n, setN] = useState(nature);
  const [b, setB] = useState(behaviour);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = n !== nature || b !== behaviour;
  const validationError = validatePair(n, b);

  async function save() {
    if (validationError || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/overheads/rule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ costHead, nature: n, behaviour: b }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to save overhead rule");
      onSaved(costHead, n, b);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <td className="px-3 py-2">
        <select
          value={n}
          disabled={!canEdit}
          onChange={(e) => {
            const nv = e.target.value;
            setN(nv);
            if (nv === "balance" || nv === "review") setB("na");
          }}
          className={selectSm}
        >
          <option value="">Unclassified</option>
          {NATURES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">
        <select value={b} disabled={!canEdit} onChange={(e) => setB(e.target.value)} className={selectSm}>
          <option value="">Choose</option>
          {BEHAVIOURS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        {validationError && dirty && <p className="mt-1 text-[10px] text-status-inactive">{validationError}</p>}
        {error && <p className="mt-1 text-[10px] text-status-inactive">{error}</p>}
      </td>
      <td className="px-3 py-2">
        <button
          onClick={save}
          disabled={!canEdit || !dirty || !!validationError || saving}
          title={canEdit ? undefined : "Requires Finance payroll access"}
          className="rounded-md border border-base-700 px-2.5 py-1 text-[11px] text-ink-300 hover:text-ink-50 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </td>
    </>
  );
}

function PaymentOverride({
  transactionId,
  tag,
  canEdit,
  onSaved,
}: {
  transactionId: string;
  tag: Tag;
  canEdit: boolean;
  onSaved: (nature: string, behaviour: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(tag.nature);
  const [b, setB] = useState(tag.behaviour);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={!canEdit}
        title={canEdit ? "Override this payment's classification" : "Requires Finance payroll access"}
        className="rounded-md border border-base-700 px-2.5 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50 disabled:opacity-40"
      >
        Open
      </button>
    );
  }
  const validationError = validatePair(n, b);
  async function save() {
    if (validationError || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/overheads/payment-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: transactionId, nature: n, behaviour: b }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to save payment override");
      onSaved(n, b);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-1">
        <select value={n} onChange={(e) => setN(e.target.value)} className={selectSm}>
          {NATURES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select value={b} onChange={(e) => setB(e.target.value)} className={selectSm}>
          {BEHAVIOURS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <button onClick={save} disabled={!!validationError || saving} className="rounded-md bg-ink-50 px-1.5 py-0.5 text-[10px] font-medium text-base-950 disabled:opacity-40">
          {saving ? "…" : "Save"}
        </button>
        <button onClick={() => setOpen(false)} className="text-[10px] text-ink-500 hover:text-ink-300">
          Cancel
        </button>
      </div>
      {(validationError || error) && <p className="text-[10px] text-status-inactive">{validationError ?? error}</p>}
    </div>
  );
}

export function OverheadAnalysisPage({
  costHeads,
  departments,
  transactions,
  rules,
  canEdit,
}: {
  costHeads: string[];
  departments: string[];
  transactions: FinanceLedgerRow[];
  rules: HeadRule[];
  canEdit: boolean;
}) {
  const filtered = useFilteredFinanceRows(transactions);
  const { filters } = useFinanceFilters();
  const [ruleMap, setRuleMap] = useState<Record<string, { nature: string; behaviour: string }>>(() =>
    Object.fromEntries(rules.map((r) => [r.costHead, { nature: r.costNature, behaviour: r.costBehaviour }]))
  );
  const [overrideMap, setOverrideMap] = useState<Record<string, { nature: string; behaviour: string }>>({});
  const [nature, setNature] = useState("overhead");
  const [behaviour, setBehaviour] = useState("fixed");
  const [head, setHead] = useState("all");
  const [search, setSearch] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  const ohRule = (t: FinanceLedgerRow): Tag => {
    const local = overrideMap[t.id];
    if (local) return { ...local, source: "Payment override" };
    if (t.overheadOverride) return { nature: t.overheadOverride.costNature, behaviour: t.overheadOverride.costBehaviour, source: "Payment override" };
    const rule = ruleMap[effectiveCentre(t)];
    return rule ? { ...rule, source: "Cost-head rule" } : { nature: "review", behaviour: "na", source: "Not reviewed" };
  };
  const matching = (t: FinanceLedgerRow) => {
    const r = ohRule(t);
    return (nature === "all" || r.nature === nature) && (behaviour === "all" || r.behaviour === behaviour) && (head === "all" || effectiveCentre(t) === head);
  };

  const base = useMemo(
    () => reportingRows(filtered, filters.department).filter((t) => t.debtPeriod === "current" && departments.includes(effectiveHead(t))),
    [filtered, filters.department, departments]
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const records = useMemo(() => base.filter(matching), [base, ruleMap, overrideMap, nature, behaviour, head]);
  const net = records.reduce((s, t) => s + t.amount, 0);
  const fixed = base.filter((t) => {
    const r = ohRule(t);
    return r.nature === "overhead" && r.behaviour === "fixed";
  });
  const unknown = base.filter((t) => ohRule(t).source === "Not reviewed");
  const heads = Array.from(new Set(base.map(effectiveCentre))).sort();
  const distinct = Array.from(new Map(records.map((t) => [t.id, t])).values());

  const monthly = new Map<string, number>();
  const depts = new Map<string, number>();
  for (const t of records) {
    monthly.set(t.month, (monthly.get(t.month) ?? 0) + t.amount);
    depts.set(effectiveHead(t), (depts.get(effectiveHead(t)) ?? 0) + t.amount);
  }
  const months = Array.from(monthly.entries()).sort(([a], [b]) => a.localeCompare(b));
  const sortedDepts = Array.from(depts.entries()).sort((a, b) => b[1] - a[1]);

  const visible = costHeads.filter((x) => x.toLowerCase().includes(search.toLowerCase()));
  const untagged = costHeads.filter((x) => !ruleMap[x] && RECOMMENDATIONS[x]);
  const { pageRows: visibleRows, pager } = useTablePager(visible);

  function quick(k: "fixed" | "variable" | "mixed" | "review" | "all") {
    setNature(k === "review" ? "review" : k === "all" ? "all" : "overhead");
    setBehaviour(k === "review" || k === "all" ? "all" : k);
    setHead("all");
  }

  async function applySuggestions() {
    if (!untagged.length || bulkBusy) return;
    if (!confirm(`Apply ${untagged.length} suggested cost-head rules? Each is undoable through Change History.`)) return;
    setBulkBusy(true);
    setBulkMessage(null);
    try {
      const payload = untagged.map((costHead) => ({ costHead, nature: RECOMMENDATIONS[costHead][0], behaviour: RECOMMENDATIONS[costHead][1] }));
      const res = await fetch("/api/finance/overheads/apply-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: payload }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to apply suggestions");
      setRuleMap((prev) => ({ ...prev, ...Object.fromEntries(payload.map((r) => [r.costHead, { nature: r.nature, behaviour: r.behaviour }])) }));
      setBulkMessage(`Applied to ${data.applied} cost head(s).`);
    } catch (err) {
      setBulkMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setBulkBusy(false);
    }
  }

  const fieldLabel = "flex flex-col gap-1 text-[10px] font-medium uppercase tracking-wide text-ink-500";
  const fieldSelect = "rounded-lg border border-base-700 bg-base-800 px-2.5 py-2 text-xs normal-case tracking-normal text-ink-50 outline-none";
  const quickBtn = "rounded-lg border border-base-700 px-2.5 py-1.5 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50";

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-ink-50">Fixed overheads &amp; cost behaviour</h2>
        <p className="mt-1 text-sm text-ink-500">
          See the recurring operating commitments behind the business, by month, department and cost head. Based on the
          chart-of-accounts and cost behaviour approach used in management accounting and Xero. These are management
          tags, never edits to the original ERP ledger.
        </p>
      </div>

      <div className="rounded-xl border border-base-700 bg-base-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-ink-50">Filter your expenditure</h3>
          <span className="rounded-full bg-base-800 px-2 py-0.5 text-[11px] text-ink-300">Accounting review required for untagged heads</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={fieldLabel}>
            Cost category
            <select value={nature} onChange={(e) => setNature(e.target.value)} className={fieldSelect}>
              <option value="all">All categories</option>
              {NATURES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldLabel}>
            Cost behaviour
            <select value={behaviour} onChange={(e) => setBehaviour(e.target.value)} className={fieldSelect}>
              <option value="all">All behaviours</option>
              {BEHAVIOURS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldLabel}>
            Cost head
            <select value={head} onChange={(e) => setHead(e.target.value)} className={fieldSelect}>
              <option value="all">All cost heads</option>
              {heads.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => quick("fixed")} className={quickBtn}>Fixed overheads</button>
          <button onClick={() => quick("variable")} className={quickBtn}>Variable overheads</button>
          <button onClick={() => quick("mixed")} className={quickBtn}>Mixed overheads</button>
          <button onClick={() => quick("review")} className={quickBtn}>Needs review</button>
          <button onClick={() => quick("all")} className={quickBtn}>All types</button>
        </div>
        <p className="mt-3 text-[11px] text-ink-500">
          Rent and permanent base salaries are generally fixed. Phone plans, utilities and licence-based software may be
          mixed. Sales commissions are variable. Project delivery and loan principal are not office overheads.
          Classifications can be overridden on individual payments.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Filtered net amount" value={usd(net, true)} detail="Signed USD net of selected classified payments" />
        <Kpi title="Matching payments" value={distinct.length.toLocaleString()} detail="Unique source payment records" />
        <Kpi
          title="Fixed overheads in period"
          value={usd(fixed.reduce((s, t) => s + t.amount, 0), true)}
          detail="Total cash movements during selected months, not a monthly run-rate"
        />
        <Kpi title="Unreviewed entries" value={unknown.length.toLocaleString()} detail="Assign cost-head tags below before treating totals as complete" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-base-700 bg-base-900 p-4">
          <h3 className="mb-2 text-sm font-medium text-ink-50">Monthly spending in selection</h3>
          {months.length ? (
            months.map(([m, v]) => (
              <div key={m} className="flex items-center justify-between border-b border-base-800 py-1.5 text-xs last:border-0">
                <span className="text-ink-300">{mo(m)}</span>
                <strong className="text-ink-50">{usd(v)}</strong>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-xs text-ink-500">No classified payments match. Check the approved cost-head classifications below.</p>
          )}
        </div>
        <div className="rounded-xl border border-base-700 bg-base-900 p-4">
          <h3 className="mb-2 text-sm font-medium text-ink-50">Department allocation</h3>
          {sortedDepts.length ? (
            sortedDepts.map(([d, v]) => (
              <div key={d} className="flex items-center justify-between border-b border-base-800 py-1.5 text-xs last:border-0">
                <span className="text-ink-300">{d}</span>
                <strong className="text-ink-50">{usd(v)}</strong>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-xs text-ink-500">No departments found for these filters.</p>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-base-700 bg-base-900 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium text-ink-50">Cost-head classification rules</h3>
          <span className="rounded-full bg-base-800 px-2 py-0.5 text-[11px] text-ink-300">
            {Object.keys(ruleMap).length} tagged / {costHeads.length} cost heads
          </span>
        </div>
        <p className="mb-3 text-[11px] text-ink-500">
          Assign the default classification once per approved cost head. Existing payment amounts are not reclassified,
          and untagged heads remain under review. You can clear a rule or override a particular payment. All changes are
          undoable through Change History.
        </p>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <button
            onClick={applySuggestions}
            disabled={!canEdit || !untagged.length || bulkBusy}
            title={canEdit ? undefined : "Requires Finance payroll access"}
            className="rounded-lg border border-base-700 px-3 py-2 text-xs font-medium text-ink-50 hover:border-base-600 disabled:opacity-40"
          >
            {bulkBusy ? "Applying…" : `Review & apply ${untagged.length} suggested rules`}
          </button>
          <label className={`${fieldLabel} min-w-[180px] flex-1`}>
            Find cost head
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search cost heads" className={fieldSelect} />
          </label>
          {bulkMessage && <span className="text-[11px] text-ink-300">{bulkMessage}</span>}
        </div>
        <div className="overflow-x-auto rounded-xl border border-base-700">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-base-700 bg-base-900 text-ink-500">
              <tr>
                <th className="px-3 py-2">Approved cost head</th>
                <th className="px-3 py-2">Cost category</th>
                <th className="px-3 py-2">Cost behaviour</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((h) => {
                const rule = ruleMap[h];
                const s = RECOMMENDATIONS[h];
                return (
                  <tr key={h} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="px-3 py-2">
                      <b className="text-ink-50">{h}</b>
                      <div className="text-[10px] text-ink-500">
                        {rule ? "Approved management rule" : s ? `Suggested: ${s[0]} / ${s[1]}` : "Needs review"}
                      </div>
                    </td>
                    <RuleEditor
                      key={`${h}-${rule?.nature ?? ""}-${rule?.behaviour ?? ""}`}
                      costHead={h}
                      nature={rule?.nature ?? ""}
                      behaviour={rule?.behaviour ?? ""}
                      canEdit={canEdit}
                      onSaved={(costHead, n, b) => setRuleMap((prev) => ({ ...prev, [costHead]: { nature: n, behaviour: b } }))}
                    />
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visible.length === 0 && <p className="px-3 py-6 text-center text-xs text-ink-500">No cost heads match the search.</p>}
          {pager}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-base-700 bg-base-900 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-ink-50">Underlying payments</h3>
          <span className="rounded-full bg-base-800 px-2 py-0.5 text-[11px] text-ink-300">
            Showing first 40 of {distinct.length} unique payments
          </span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-base-700">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-base-700 bg-base-900 text-ink-500">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Department</th>
                <th className="px-3 py-2">Cost head</th>
                <th className="px-3 py-2 text-right">Net amount</th>
                <th className="px-3 py-2">Review</th>
              </tr>
            </thead>
            <tbody>
              {distinct.slice(0, 40).map((t) => (
                <tr key={t.id} className="border-b border-base-800 text-ink-300 last:border-0">
                  <td className="px-3 py-2">{t.date ? new Date(t.date).toLocaleDateString("en-GB") : mo(t.month)}</td>
                  <td className="max-w-[260px] truncate px-3 py-2" title={t.description}>
                    {t.description}
                  </td>
                  <td className="px-3 py-2">{effectiveHead(t)}</td>
                  <td className="px-3 py-2">{effectiveCentre(t)}</td>
                  <td className="px-3 py-2 text-right">{usd(t.amount)}</td>
                  <td className="px-3 py-2">
                    <PaymentOverride
                      transactionId={t.id}
                      tag={ohRule(t)}
                      canEdit={canEdit}
                      onSaved={(n, b) => setOverrideMap((prev) => ({ ...prev, [t.id]: { nature: n, behaviour: b } }))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {distinct.length === 0 && <p className="px-3 py-4 text-xs text-ink-500">No matching payments.</p>}
        </div>
        <Link href="/finance/payments" className="mt-2 inline-block text-[11px] text-ink-500 hover:text-ink-300">
          Open All Payments ↗
        </Link>
      </div>

      <div className="mt-4 rounded-lg border border-status-alert/30 bg-status-alert/10 px-3 py-2 text-[11px] text-status-alert">
        This is a cash-payment analysis, not an accrual-basis profit &amp; loss statement. An annual insurance payment
        should be normalised across coverage months for monthly run-rate analysis. VAT, prepaid items, depreciation,
        capital expenditure, and loan repayments require accountant-approved treatment. Department splits are counted at
        their allocated amounts, not again as the whole payment.
      </div>
    </div>
  );
}
