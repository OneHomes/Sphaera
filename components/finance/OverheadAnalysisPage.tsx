"use client";

import { useMemo, useState } from "react";
import { Tags, PieChart, Sparkles } from "lucide-react";
import { WidgetCard } from "@/components/dashboard/WidgetCard";

type HeadRule = { costHead: string; costNature: string; costBehaviour: string; updatedAt: string | Date };
type TxSlice = {
  id: string;
  amount: number;
  managementCostHead: string | null;
  overheadOverride: { costNature: string; costBehaviour: string } | null;
};

const NATURES = [
  { value: "", label: "Unclassified" },
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

function formatUsd(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-base-700 bg-base-800 p-3">
      <p className="text-[11px] text-ink-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-ink-50">{value}</p>
    </div>
  );
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

function natureBadge(nature: string) {
  const styles: Record<string, string> = {
    overhead: "bg-status-active/15 text-status-active",
    direct: "bg-sky-500/15 text-sky-400",
    balance: "bg-status-alert/15 text-status-alert",
    review: "bg-status-alert/15 text-status-alert",
    "": "bg-status-inactive/15 text-status-inactive",
  };
  const label = NATURES.find((n) => n.value === nature)?.label ?? "Unclassified";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[nature] ?? styles[""]}`}>{label}</span>;
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
    return (
      <div className="flex items-center gap-2">
        {natureBadge(nature)}
        {nature && <span className="text-[11px] text-ink-500">{behaviour}</span>}
      </div>
    );
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

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkNature, setBulkNature] = useState("overhead");
  const [bulkBehaviour, setBulkBehaviour] = useState("fixed");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  function effectiveNatureFor(tx: TxSlice): string {
    if (tx.overheadOverride) return tx.overheadOverride.costNature;
    if (tx.managementCostHead && ruleMap[tx.managementCostHead]) return ruleMap[tx.managementCostHead].nature;
    return "";
  }

  const spendByNature = useMemo(() => {
    const totals: Record<string, number> = { overhead: 0, direct: 0, balance: 0, review: 0, "": 0 };
    for (const tx of transactions) {
      const nature = effectiveNatureFor(tx);
      totals[nature] = (totals[nature] ?? 0) + tx.amount;
    }
    return totals;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, ruleMap]);

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

  const unclassifiedHeads = costHeads.filter((h) => !ruleMap[h]);

  function toggleSelected(head: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(head)) next.delete(head);
      else next.add(head);
      return next;
    });
  }

  async function applyBulk() {
    if (selected.size === 0 || bulkBusy) return;
    const err = validatePair(bulkNature, bulkBehaviour);
    if (err) {
      setBulkError(err);
      return;
    }
    setBulkBusy(true);
    setBulkError(null);
    setBulkMessage(null);
    try {
      const rulesPayload = Array.from(selected).map((costHead) => ({
        costHead,
        nature: bulkNature,
        behaviour: bulkBehaviour,
      }));
      const res = await fetch("/api/finance/overheads/apply-suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: rulesPayload }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Failed to apply suggestions");
      setRuleMap((prev) => {
        const next = { ...prev };
        for (const head of selected) next[head] = { nature: bulkNature, behaviour: bulkBehaviour };
        return next;
      });
      setBulkMessage(`Applied to ${data.applied} cost head(s).`);
      setSelected(new Set());
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-50">Overhead Analysis</h1>
          <p className="mt-1 text-sm text-ink-500">
            Classify every approved cost head by nature and behaviour, and see where spend currently sits.
          </p>
        </div>
      </div>

      {!canEdit && (
        <div className="mb-4 rounded-lg border border-status-alert/30 bg-status-alert/10 px-3 py-2 text-xs text-status-alert">
          Payroll access is required to change overhead classifications. You can view the current rules below.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <WidgetCard title="Overhead" icon={PieChart}>
          <Tile label="Classified as overhead" value={formatUsd(spendByNature.overhead ?? 0)} />
        </WidgetCard>
        <WidgetCard title="Direct" icon={PieChart}>
          <Tile label="Classified as direct" value={formatUsd(spendByNature.direct ?? 0)} />
        </WidgetCard>
        <WidgetCard title="Balance sheet" icon={PieChart}>
          <Tile label="Balance-sheet movements" value={formatUsd(spendByNature.balance ?? 0)} />
        </WidgetCard>
        <WidgetCard title="Pending review" icon={PieChart}>
          <Tile label="Awaiting classification review" value={formatUsd(spendByNature.review ?? 0)} />
        </WidgetCard>
        <WidgetCard title="Unclassified" icon={PieChart}>
          <Tile label="No nature/behaviour tag" value={formatUsd(spendByNature[""] ?? 0)} />
        </WidgetCard>
      </div>

      {canEdit && unclassifiedHeads.length > 0 && (
        <div className="mt-4">
          <WidgetCard title="Bulk-classify unclassified cost heads" icon={Sparkles}>
            <p className="mb-2 text-xs text-ink-500">
              Select cost heads with no existing rule, pick a nature/behaviour, and apply it to all of them at once.
              Heads that already carry a rule are left untouched.
            </p>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <select
                value={bulkNature}
                onChange={(e) => {
                  const nv = e.target.value;
                  setBulkNature(nv);
                  if (nv === "balance" || nv === "review") setBulkBehaviour("na");
                  if (nv === "direct" && bulkBehaviour === "na") setBulkBehaviour("fixed");
                }}
                className="rounded-md border border-base-700 bg-base-800 px-2 py-1 text-xs text-ink-50 outline-none"
              >
                {NATURES.filter((n) => n.value).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                value={bulkBehaviour}
                onChange={(e) => setBulkBehaviour(e.target.value)}
                className="rounded-md border border-base-700 bg-base-800 px-2 py-1 text-xs text-ink-50 outline-none"
              >
                {BEHAVIOURS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                onClick={applyBulk}
                disabled={selected.size === 0 || bulkBusy}
                className="rounded-md bg-ink-50 px-3 py-1.5 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-40"
              >
                {bulkBusy ? "Applying…" : `Apply to ${selected.size} selected`}
              </button>
              {bulkError && <span className="text-[11px] text-status-inactive">{bulkError}</span>}
              {bulkMessage && <span className="text-[11px] text-status-active">{bulkMessage}</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {unclassifiedHeads.map((head) => (
                <button
                  key={head}
                  onClick={() => toggleSelected(head)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] ${
                    selected.has(head)
                      ? "border-ink-50 bg-ink-50 text-base-950"
                      : "border-base-700 bg-base-800 text-ink-300 hover:border-base-600"
                  }`}
                >
                  {head}
                </button>
              ))}
            </div>
          </WidgetCard>
        </div>
      )}

      <div className="mt-4">
        <WidgetCard title="Cost Heads" icon={Tags}>
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Cost head</th>
                  <th className="px-3 py-2">Current tag</th>
                  <th className="px-3 py-2">Spend (recorded)</th>
                  <th className="px-3 py-2"># Payments</th>
                </tr>
              </thead>
              <tbody>
                {costHeads.map((head) => {
                  const rule = ruleMap[head];
                  const spend = spendByHead[head];
                  return (
                    <tr key={head} className="border-b border-base-800 text-ink-300 last:border-0">
                      <td className="px-3 py-2 font-medium text-ink-50">{head}</td>
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
                      <td className="px-3 py-2">{formatUsd(spend?.amount ?? 0)}</td>
                      <td className="px-3 py-2">{spend?.count ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </WidgetCard>
      </div>
    </div>
  );
}
