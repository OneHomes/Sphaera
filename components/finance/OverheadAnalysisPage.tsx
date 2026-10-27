"use client";

import { useMemo, useState } from "react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

// Direct structural/content port of the source app's Overhead Analysis
// screen — same header copy, same filter panel + quick-filter buttons +
// explainer text, same 4 KPI cards, same monthly/department split, same
// cost-head classification-rules panel (with suggestion bulk-apply +
// search), same underlying-payments table (first 40) with a per-payment
// review action, same closing caveat. Only the visual implementation
// (WidgetCard/Tailwind) replaces the original's bespoke CSS.

type HeadRule = { costHead: string; costNature: string; costBehaviour: string; updatedAt: string | Date };
type TxSlice = {
  id: string;
  date: string | Date;
  month: string;
  description: string;
  amount: number;
  managementDepartment: string | null;
  managementCostHead: string | null;
  overheadOverride: { costNature: string; costBehaviour: string } | null;
};

const NATURES = [
  { value: "overhead", label: "Overhead" },
  { value: "direct", label: "Direct" },
  { value: "balance", label: "Balance sheet" },
  { value: "review", label: "Pending review" },
];
const BEHAVIOURS = [
  { value: "na", label: "N/A" },
  { value: "fixed", label: "Fixed" },
  { value: "variable", label: "Variable" },
  { value: "mixed", label: "Mixed" },
  { value: "oneoff", label: "One-off" },
];

type CategoryFilter = "all" | "overhead" | "direct" | "balance" | "review" | "unclassified";
type BehaviourFilter = "all" | "fixed" | "variable" | "mixed" | "oneoff" | "na";

function usd(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

/** Mirrors lib/finance/peopleOverheadsData.ts's overheadPair() for client-side UX. */
function validatePair(nature: string, behaviour: string): string | null {
  if (!nature && !behaviour) return null;
  if (!nature) return "Choose a cost nature.";
  if ((nature === "balance" || nature === "review") && behaviour !== "na") {
    return "Balance-sheet or pending-review movements must use N/A behaviour.";
  }
  if (nature === "direct" && behaviour === "na") {
    return "Direct costs require a real cost behaviour.";
  }
  return null;
}

/**
 * Keyword heuristic behind "Review & apply N suggested rules" — mirrors
 * the explainer copy on this screen (rent/base salary = fixed; phone,
 * utilities, licence software = mixed; commissions = variable; project
 * delivery/loan principal are not office overheads).
 */
function suggestForHead(head: string): { nature: string; behaviour: string } | null {
  const h = head.toLowerCase();
  if (/rent|lease/.test(h)) return { nature: "overhead", behaviour: "fixed" };
  if (/salar/.test(h)) return { nature: "overhead", behaviour: "fixed" };
  if (/commission/.test(h)) return { nature: "overhead", behaviour: "variable" };
  if (/phone|utilit|licen[sc]e|subscription/.test(h)) return { nature: "overhead", behaviour: "mixed" };
  if (/loan principal|principal repayment/.test(h)) return { nature: "balance", behaviour: "na" };
  if (/project delivery|project cost|cost of goods|cogs/.test(h)) return { nature: "direct", behaviour: "variable" };
  return null;
}

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
  const [b, setB] = useState(behaviour === "" && nature !== "" ? "na" : behaviour);
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

  if (!canEdit) {
    return <span className="text-[11px] text-ink-500">{nature ? `${nature} / ${behaviour}` : "Unclassified"}</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <select
          value={n}
          onChange={(e) => {
            const nv = e.target.value;
            setN(nv);
            if (nv === "balance" || nv === "review") setB("na");
            if (nv === "direct" && b === "na") setB("fixed");
          }}
          className="rounded-md border border-base-700 bg-base-800 px-1.5 py-1 text-[11px] text-ink-50 outline-none"
        >
          <option value="">Unclassified</option>
          {NATURES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={b}
          disabled={!n}
          onChange={(e) => setB(e.target.value)}
          className="rounded-md border border-base-700 bg-base-800 px-1.5 py-1 text-[11px] text-ink-50 outline-none disabled:opacity-40"
        >
          {BEHAVIOURS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button
          onClick={save}
          disabled={!dirty || !!validationError || saving}
          className="rounded-md bg-ink-50 px-2 py-1 text-[11px] font-medium text-base-950 hover:bg-white disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {validationError && dirty && <p className="text-[10px] text-status-inactive">{validationError}</p>}
      {error && <p className="text-[10px] text-status-inactive">{error}</p>}
    </div>
  );
}

function PaymentReviewButton({
  transactionId,
  nature,
  behaviour,
  canEdit,
  onSaved,
}: {
  transactionId: string;
  nature: string;
  behaviour: string;
  canEdit: boolean;
  onSaved: (nature: string, behaviour: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(nature);
  const [b, setB] = useState(behaviour || "na");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canEdit) return <span className="text-[11px] text-ink-600">—</span>;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:border-base-600 hover:text-ink-50"
      >
        Review
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
        <select value={n} onChange={(e) => setN(e.target.value)} className="rounded-md border border-base-700 bg-base-800 px-1 py-0.5 text-[10px] text-ink-50 outline-none">
          <option value="">Unclassified</option>
          {NATURES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select value={b} onChange={(e) => setB(e.target.value)} className="rounded-md border border-base-700 bg-base-800 px-1 py-0.5 text-[10px] text-ink-50 outline-none">
          {BEHAVIOURS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
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
  transactions,
  rules,
  canEdit,
}: {
  costHeads: string[];
  transactions: TxSlice[];
  rules: HeadRule[];
  canEdit: boolean;
}) {
  const [ruleMap, setRuleMap] = useState<Record<string, { nature: string; behaviour: string }>>(() => {
    const map: Record<string, { nature: string; behaviour: string }> = {};
    for (const r of rules) map[r.costHead] = { nature: r.costNature, behaviour: r.costBehaviour };
    return map;
  });
  const [overrideMap, setOverrideMap] = useState<Record<string, { nature: string; behaviour: string }>>({});

  const [category, setCategory] = useState<CategoryFilter>("all");
  const [behaviourFilter, setBehaviourFilter] = useState<BehaviourFilter>("all");
  const [costHeadFilter, setCostHeadFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  function effectiveTag(tx: TxSlice): { nature: string; behaviour: string } {
    const localOverride = overrideMap[tx.id];
    if (localOverride) return localOverride;
    if (tx.overheadOverride) return { nature: tx.overheadOverride.costNature, behaviour: tx.overheadOverride.costBehaviour };
    if (tx.managementCostHead && ruleMap[tx.managementCostHead]) return ruleMap[tx.managementCostHead];
    return { nature: "", behaviour: "" };
  }

  function matches(tx: TxSlice): boolean {
    if (costHeadFilter !== "all" && tx.managementCostHead !== costHeadFilter) return false;
    const { nature, behaviour } = effectiveTag(tx);
    if (category === "unclassified") {
      if (nature !== "") return false;
    } else if (category !== "all" && nature !== category) {
      return false;
    }
    if (behaviourFilter !== "all" && behaviour !== behaviourFilter) return false;
    return true;
  }

  const filteredTransactions = useMemo(
    () => transactions.filter(matches),
    [transactions, ruleMap, overrideMap, category, behaviourFilter, costHeadFilter]
  );

  const filteredNet = filteredTransactions.reduce((s, t) => s + t.amount, 0);

  const fixedInPeriod = useMemo(
    () =>
      transactions
        .filter((t) => {
          const { nature, behaviour } = effectiveTag(t);
          return nature === "overhead" && behaviour === "fixed";
        })
        .reduce((s, t) => s + t.amount, 0),
    [transactions, ruleMap, overrideMap]
  );

  const unreviewedCount = useMemo(
    () =>
      transactions.filter((t) => {
        if (!t.managementCostHead) return false;
        return effectiveTag(t).nature === "";
      }).length,
    [transactions, ruleMap, overrideMap]
  );

  const monthlyInSelection = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of filteredTransactions) map.set(t.month, (map.get(t.month) ?? 0) + t.amount);
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredTransactions]);

  const departmentAllocation = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of filteredTransactions) {
      const key = t.managementDepartment ?? "Unclassified";
      map.set(key, (map.get(key) ?? 0) + t.amount);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filteredTransactions]);

  const spendByHead = useMemo(() => {
    const totals: Record<string, { amount: number; count: number }> = {};
    for (const tx of transactions) {
      if (!tx.managementCostHead) continue;
      const cur = totals[tx.managementCostHead] ?? { amount: 0, count: 0 };
      cur.amount += tx.amount;
      cur.count += 1;
      totals[tx.managementCostHead] = cur;
    }
    return totals;
  }, [transactions]);

  const suggestions = useMemo(
    () => costHeads.filter((h) => !ruleMap[h] && suggestForHead(h)),
    [costHeads, ruleMap]
  );

  const searchedHeads = useMemo(
    () => (search.trim() ? costHeads.filter((h) => h.toLowerCase().includes(search.trim().toLowerCase())) : costHeads),
    [costHeads, search]
  );

  const taggedCount = costHeads.filter((h) => ruleMap[h]).length;

  async function applySuggestions() {
    if (suggestions.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    setBulkError(null);
    setBulkMessage(null);
    try {
      const rulesPayload = suggestions.map((costHead) => {
        const s = suggestForHead(costHead)!;
        return { costHead, nature: s.nature, behaviour: s.behaviour };
      });
      const res = await fetch("/api/finance/overheads/apply-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: rulesPayload }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to apply suggestions");
      setRuleMap((prev) => {
        const next = { ...prev };
        for (const r of rulesPayload) next[r.costHead] = { nature: r.nature, behaviour: r.behaviour };
        return next;
      });
      setBulkMessage(`Applied to ${data.applied} cost head(s).`);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBulkBusy(false);
    }
  }

  function setQuickFilter(c: CategoryFilter, b: BehaviourFilter) {
    setCategory(c);
    setBehaviourFilter(b);
    if (c === "all") setCostHeadFilter("all");
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-ink-50">Fixed overheads & cost behaviour</h2>
        <p className="mt-1 text-sm text-ink-500">
          See the recurring operating commitments behind the business, by month, department and cost head. Based on
          the chart-of-accounts and cost behaviour approach used in management accounting and Xero. These are
          management tags, never edits to the original ERP ledger.
        </p>
      </div>

      {!canEdit && (
        <div className="mb-4 rounded-lg border border-status-alert/30 bg-status-alert/10 px-3 py-2 text-xs text-status-alert">
          Payroll access is required to change overhead classifications. You can view the current rules below.
        </div>
      )}

      <WidgetCard title="Filters">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-ink-500">
            Cost category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryFilter)}
              className="rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs text-ink-50 outline-none"
            >
              <option value="all">All</option>
              {NATURES.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-ink-500">
            Cost behaviour
            <select
              value={behaviourFilter}
              onChange={(e) => setBehaviourFilter(e.target.value as BehaviourFilter)}
              className="rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs text-ink-50 outline-none"
            >
              <option value="all">All</option>
              {BEHAVIOURS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-ink-500">
            Cost head
            <select
              value={costHeadFilter}
              onChange={(e) => setCostHeadFilter(e.target.value)}
              className="rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs text-ink-50 outline-none"
            >
              <option value="all">All</option>
              {costHeads.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button onClick={() => setQuickFilter("overhead", "fixed")} className="rounded-full border border-base-700 px-2.5 py-1 text-[11px] text-ink-300 hover:border-base-600">
            Fixed overheads
          </button>
          <button onClick={() => setQuickFilter("overhead", "variable")} className="rounded-full border border-base-700 px-2.5 py-1 text-[11px] text-ink-300 hover:border-base-600">
            Variable overheads
          </button>
          <button onClick={() => setQuickFilter("overhead", "mixed")} className="rounded-full border border-base-700 px-2.5 py-1 text-[11px] text-ink-300 hover:border-base-600">
            Mixed overheads
          </button>
          <button onClick={() => setQuickFilter("unclassified", "all")} className="rounded-full border border-base-700 px-2.5 py-1 text-[11px] text-ink-300 hover:border-base-600">
            Needs review
          </button>
          <button onClick={() => setQuickFilter("all", "all")} className="rounded-full border border-base-700 px-2.5 py-1 text-[11px] text-ink-300 hover:border-base-600">
            All types
          </button>
        </div>
        <p className="text-[11px] text-ink-500">
          Rent and permanent base salaries are generally fixed. Phone plans, utilities and licence-based software may
          be mixed. Sales commissions are variable. Project delivery and loan principal are not office overheads.
          Classifications can be overridden on individual payments.
        </p>
      </WidgetCard>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Filtered net amount" value={usd(filteredNet)} detail="Sum of payments matching the current filter" />
        <Kpi title="Matching payments" value={filteredTransactions.length.toLocaleString()} detail="Unique payments matching the filter" />
        <Kpi title="Fixed overheads in period" value={usd(fixedInPeriod)} detail="Overhead / fixed, across all payments" />
        <Kpi title="Unreviewed entries" value={unreviewedCount.toLocaleString()} detail="Have a cost head but no classification yet" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WidgetCard title="Monthly spending in selection">
          <div className="flex max-h-[220px] flex-col gap-1 overflow-y-auto">
            {monthlyInSelection.map(([month, amount]) => (
              <div key={month} className="flex items-center justify-between border-b border-base-800 py-1 text-xs">
                <span className="text-ink-300">{month}</span>
                <span className="font-medium text-ink-50">{usd(amount)}</span>
              </div>
            ))}
            {monthlyInSelection.length === 0 && <p className="text-xs text-ink-500">No payments match the current filter.</p>}
          </div>
        </WidgetCard>
        <WidgetCard title="Department allocation">
          <div className="flex max-h-[220px] flex-col gap-1 overflow-y-auto">
            {departmentAllocation.map(([dept, amount]) => (
              <div key={dept} className="flex items-center justify-between border-b border-base-800 py-1 text-xs">
                <span className="text-ink-300">{dept}</span>
                <span className="font-medium text-ink-50">{usd(amount)}</span>
              </div>
            ))}
            {departmentAllocation.length === 0 && <p className="text-xs text-ink-500">No payments match the current filter.</p>}
          </div>
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard
          title="Cost-head classification rules"
          action={
            <span className="rounded-full bg-base-800 px-2 py-0.5 text-[11px] text-ink-300">
              {taggedCount} tagged / {costHeads.length} cost heads
            </span>
          }
        >
          <p className="mb-2 text-xs text-ink-500">
            Assign a default classification once per cost head — new payments under that cost head inherit it
            automatically. Classifications can still be overridden on individual payments below.
          </p>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {canEdit && suggestions.length > 0 && (
              <button
                onClick={applySuggestions}
                disabled={bulkBusy}
                className="rounded-md bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-40"
              >
                {bulkBusy ? "Applying…" : `Review & apply ${suggestions.length} suggested rules`}
              </button>
            )}
            {bulkError && <span className="text-[11px] text-status-inactive">{bulkError}</span>}
            {bulkMessage && <span className="text-[11px] text-status-active">{bulkMessage}</span>}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cost heads…"
              className="ml-auto rounded-lg border border-base-700 bg-base-800 px-2 py-1.5 text-xs text-ink-50 outline-none placeholder:text-ink-500"
            />
          </div>
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Approved cost head</th>
                  <th className="px-3 py-2">Cost category / behaviour</th>
                  <th className="px-3 py-2">Spend</th>
                </tr>
              </thead>
              <tbody>
                {searchedHeads.map((head) => {
                  const rule = ruleMap[head];
                  const spend = spendByHead[head];
                  const suggestion = suggestForHead(head);
                  const subtext = rule
                    ? "Approved management rule"
                    : suggestion
                      ? `Suggested: ${suggestion.nature} / ${suggestion.behaviour}`
                      : "Needs review";
                  return (
                    <tr key={head} className="border-b border-base-800 text-ink-300 last:border-0">
                      <td className="px-3 py-2">
                        <div className="font-medium text-ink-50">{head}</div>
                        <div className="text-[10px] text-ink-500">{subtext}</div>
                      </td>
                      <td className="px-3 py-2">
                        <RuleEditor
                          costHead={head}
                          nature={rule?.nature ?? ""}
                          behaviour={rule?.behaviour ?? ""}
                          canEdit={canEdit}
                          onSaved={(costHead, nature, behaviour) =>
                            setRuleMap((prev) => ({ ...prev, [costHead]: { nature, behaviour } }))
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        {usd(spend?.amount ?? 0)} · {spend?.count ?? 0} pmts
                      </td>
                    </tr>
                  );
                })}
                {searchedHeads.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-ink-500">
                      No cost heads match your search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard title={`Underlying payments${filteredTransactions.length > 40 ? ` (first 40 of ${filteredTransactions.length.toLocaleString()})` : ""}`}>
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
                {filteredTransactions.slice(0, 40).map((t) => {
                  const tag = effectiveTag(t);
                  return (
                    <tr key={t.id} className="border-b border-base-800 text-ink-300 last:border-0">
                      <td className="px-3 py-2">{new Date(t.date).toLocaleDateString()}</td>
                      <td className="max-w-[260px] truncate px-3 py-2" title={t.description}>
                        {t.description}
                      </td>
                      <td className="px-3 py-2">{t.managementDepartment ?? "—"}</td>
                      <td className="px-3 py-2">{t.managementCostHead ?? "—"}</td>
                      <td className="px-3 py-2 text-right">{usd(t.amount)}</td>
                      <td className="px-3 py-2">
                        <PaymentReviewButton
                          transactionId={t.id}
                          nature={tag.nature}
                          behaviour={tag.behaviour}
                          canEdit={canEdit}
                          onSaved={(nature, behaviour) =>
                            setOverrideMap((prev) => ({ ...prev, [t.id]: { nature, behaviour } }))
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-ink-500">
                      No payments match the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </WidgetCard>
      </div>

      <div className="mt-4 rounded-lg border border-status-alert/30 bg-status-alert/10 px-3 py-2 text-[11px] text-status-alert">
        This is a cash-payment analysis, not an accrual-basis profit & loss statement. An annual insurance payment
        should be normalised across coverage months for monthly run-rate analysis. VAT, prepaid items, depreciation,
        capital expenditure, and loan repayments require accountant-approved treatment. Department splits are counted
        at their allocated amounts, not again as the whole payment.
      </div>
    </div>
  );
}
