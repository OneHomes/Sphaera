"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarRange,
  PieChart as PieChartIcon,
  ClipboardList,
  Banknote,
  Target,
  ListChecks,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { WidgetCard } from "@/components/dashboard/WidgetCard";
import { useFilteredFinanceRows, useFinanceFilters } from "./FinanceFilterContext";
import { ListSearch, ShowMoreBar, useListSearch, useShowMore } from "./ShowMore";
import { fyOf } from "@/lib/finance/financeFilters";
import { effectiveCentre, effectiveHead, isOperating, mo, reportingRows } from "@/lib/finance/financeReporting";
import type { FinanceLedgerRow } from "@/lib/finance/ledgerData";

type PlanRow = {
  id: string;
  fyStart: number;
  version: number;
  name: string | null;
  status: string;
  createdAt: string | Date;
  approvedAt: string | Date | null;
};
type PlanLineRow = { id: string; planId: string; month: string; department: string; costHead: string; budgetUsd: number };
type PlanTargetRow = { id: string; planId: string; month: string; salesTargetUsd: number; collectionsTargetUsd: number };

type TransactionRow = FinanceLedgerRow;

type BudgetRowDraft = { department: string; costHead: string; annualBudgetUsd: string };

type PreviewIssue = { row: number; error: string; month?: string | null; department?: string; costHead?: string };
type PreviewResult = {
  ok: true;
  token: string;
  year: number;
  fy: string;
  filename: string;
  format: string;
  valid: number;
  targets: number;
  emptySkipped: number;
  invalid: number;
  issues: PreviewIssue[];
  totalUsd: number;
  sample: { month: string; department: string; costHead: string; budgetUsd: number }[];
  ready: boolean;
  note?: string;
};


function fyName(fyStart: number): string {
  return `FY${fyStart}/${String((fyStart + 1) % 100).padStart(2, "0")}`;
}

/** Nov-Oct fiscal year months, in order, as "YYYY-MM" strings — local port
 * of financeFiscalYearMonths() kept dependency-free so this client
 * component never pulls in the server-only lib/finance/financialPlanningData
 * module (it imports prisma + exceljs at module scope). */
function fiscalYearMonths(fyStart: number): string[] {
  const calendarMonths = [11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return calendarMonths.map((m) => {
    const year = m >= 11 ? fyStart : fyStart + 1;
    return `${year}`.padStart(4, "0") + "-" + String(m).padStart(2, "0");
  });
}

function fiscalYearStartFromDate(d: Date): number {
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  return month >= 11 ? year : year - 1;
}


function usd(value: number): string {
  return `${value < 0 ? "-" : ""}$${Math.abs(Math.round(value)).toLocaleString()}`;
}

const DONUT_COLORS = ["#14b8a6", "#ef4444", "#f59e0b", "#d4af37", "#9ca3af", "#7965bd", "#60a5fa", "#fb923c"];

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

function PlanKpi({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-base-700 bg-base-900 p-4">
      <h4 className="text-[11px] text-ink-500">{title}</h4>
      <div className="mt-1 text-xl font-semibold text-ink-50">{value}</div>
      <div className="mt-1 text-[11px] text-ink-500">{detail}</div>
    </div>
  );
}

function usdCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return usd(value);
}

export function FinancialPlanningPage({
  plans: initialPlans,
  lines: initialLines,
  targets: initialTargets,
  departments,
  costHeads,
  transactions: allTransactions,
}: {
  plans: PlanRow[];
  lines: PlanLineRow[];
  targets: PlanTargetRow[];
  departments: string[];
  costHeads: string[];
  transactions: TransactionRow[];
}) {
  const router = useRouter();
  const { filters, setFilters } = useFinanceFilters();
  const transactions = useFilteredFinanceRows(allTransactions);
  const [plans, setPlans] = useState<PlanRow[]>(initialPlans);
  const [lines, setLines] = useState<PlanLineRow[]>(initialLines);
  const [targets, setTargets] = useState<PlanTargetRow[]>(initialTargets);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [showPlanModal, setShowPlanModal] = useState(false);

  async function reload() {
    const res = await fetch("/api/finance/plans");
    if (res.ok) {
      const data = await res.json();
      setPlans(data.plans ?? []);
      setLines(data.lines ?? []);
      setTargets(data.targets ?? []);
    }
  }

  // Source planningYear(): the planning page follows the global FY filter.
  const year = filters.fy === "all" ? fiscalYearStartFromDate(new Date()) : Number(filters.fy);
  const activePlanFor = (fy: number) =>
    plans.filter((p) => p.fyStart === fy && p.status === "Approved").sort((a, b) => b.version - a.version)[0] ?? null;
  const versions = plans.filter((p) => p.fyStart === year).sort((a, b) => b.version - a.version);
  const plan = (selectedPlanId && versions.find((p) => p.id === selectedPlanId)) || activePlanFor(year) || versions[0] || null;

  // Source planningFilters(): department and month filters narrow the plan lines too.
  const planLines = useMemo(() => {
    let l = plan ? lines.filter((x) => x.planId === plan.id) : [];
    if (filters.department !== "all") l = l.filter((x) => x.department === filters.department);
    if (filters.start !== "all") l = l.filter((x) => x.month >= filters.start);
    if (filters.end !== "all") l = l.filter((x) => x.month <= filters.end);
    return l;
  }, [lines, plan, filters.department, filters.start, filters.end]);
  const planTargets = useMemo(
    () =>
      plan
        ? targets.filter(
            (x) =>
              x.planId === plan.id &&
              (filters.start === "all" || x.month >= filters.start) &&
              (filters.end === "all" || x.month <= filters.end)
          )
        : [],
    [targets, plan, filters.start, filters.end]
  );

  const tx = useMemo(
    () => reportingRows(transactions, filters.department).filter((t) => isOperating(t, departments)),
    [transactions, filters.department, departments]
  );
  const budget = planLines.reduce((s, l) => s + l.budgetUsd, 0);
  const plannedSales = planTargets.reduce((s, t) => s + (t.salesTargetUsd || 0), 0);
  const plannedCollections = planTargets.reduce((s, t) => s + (t.collectionsTargetUsd || 0), 0);
  const actual = tx.reduce((s, t) => s + t.amount, 0);

  const deptRows = departments.map((dept) => ({
    dept,
    budget: planLines.filter((x) => x.department === dept).reduce((s, x) => s + x.budgetUsd, 0),
    actual: tx.filter((t) => effectiveHead(t) === dept).reduce((s, t) => s + t.amount, 0),
    count: planLines.filter((x) => x.department === dept).length,
  }));
  const donutData = deptRows.filter((x) => x.budget > 0).map((x) => ({ name: x.dept, value: x.budget }));

  const headMap = new Map<string, { department: string; head: string; budget: number }>();
  for (const l of planLines) {
    const key = `${l.department} | ${l.costHead}`;
    const o = headMap.get(key) ?? { department: l.department, head: l.costHead, budget: 0 };
    o.budget += l.budgetUsd;
    headMap.set(key, o);
  }
  const heads = Array.from(headMap.values())
    .map((x) => ({
      ...x,
      actual: tx
        .filter((t) => effectiveHead(t) === x.department && effectiveCentre(t) === x.head)
        .reduce((s, t) => s + t.amount, 0),
    }))
    .sort((a, b) => b.budget - a.budget);
  const headSearch = useListSearch(heads, (r) => [r.department, r.head]);
  const scopeKey = `${plan?.id ?? ""}|${filters.department}|${filters.start}|${filters.end}`;
  const headMore = useShowMore(headSearch.filtered, `${headSearch.filtered.length}|${headSearch.query}|${scopeKey}`);
  const deptMore = useShowMore(deptRows, `${deptRows.length}|${scopeKey}`);

  const monthlyRows = fiscalYearMonths(year)
    .filter((m) => (filters.start === "all" || m >= filters.start) && (filters.end === "all" || m <= filters.end))
    .map((m) => {
      const target = planTargets.find((t) => t.month === m);
      const c = planLines.filter((l) => l.month === m);
      return {
        month: m,
        sales: target ? target.salesTargetUsd : null,
        collections: target ? target.collectionsTargetUsd : null,
        budget: c.length ? c.reduce((s, l) => s + l.budgetUsd, 0) : null,
      };
    });

  const yearRows = Array.from(
    new Set([2025, 2026, 2027, ...plans.map((p) => p.fyStart), ...allTransactions.map((t) => fyOf(t.month))])
  )
    .sort((a, b) => a - b)
    .map((y) => {
      const p = activePlanFor(y);
      return {
        fy: y,
        plan: p,
        annualBudget: p ? lines.filter((l) => l.planId === p.id).reduce((s, l) => s + l.budgetUsd, 0) : null,
        spend: allTransactions
          .filter((t) => fyOf(t.month) === y && isOperating(t, departments))
          .reduce((s, t) => s + t.amount, 0),
      };
    });

  function handleExport() {
    const header = ["Department", "Cost Head", "Plan (selected period)", "Recorded actual"];
    const rows = [header, ...heads.map((r) => [r.department, r.head, r.budget.toFixed(2), r.actual.toFixed(2)])];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget-lines-${fyName(year)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const canRevise = activePlanFor(year) !== null;
  const status = plan ? plan.status : "No plan yet";

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-ink-50">Financial planning, {fyName(year)}</h2>
        <p className="mt-1 text-sm text-ink-500">
          Approved November to October targets and spending budgets. Actual spending comes from the ERP,
          independently of your plan.
        </p>
      </div>

      <div className="rounded-xl border border-base-700 bg-base-900 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-ink-50">Financial year control</h3>
            <p className="mt-1 text-[11px] text-ink-500">
              Enter the new year&apos;s targets directly, review them and lock the approved version in the SQL
              database. No Excel upload required.
            </p>
          </div>
          <button
            onClick={() => setShowPlanModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white"
          >
            {canRevise ? "Create a revised plan" : "Start new financial year"} ↗
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex-1 text-[10px] font-medium uppercase tracking-wide text-ink-500">
            Viewing version
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-base-700 bg-base-800 px-2.5 py-2 text-xs normal-case tracking-normal text-ink-50 outline-none"
            >
              <option value="">Latest approved plan</option>
              {versions.map((p) => (
                <option key={p.id} value={p.id}>
                  v{p.version} · {p.status} · {p.name ?? ""}
                </option>
              ))}
            </select>
          </label>
          <span
            className={`mb-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              plan?.status === "Approved" ? "bg-status-active/15 text-status-active" : "bg-status-alert/15 text-status-alert"
            }`}
          >
            {status}
            {plan ? ` · version ${plan.version}` : ""}
          </span>
        </div>
        <p className="mt-2 text-[11px] text-ink-500">
          Approved figures cannot be edited. Revisions create a new numbered version and preserve the previous
          approved figures.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <PlanKpi title="Budget in selected view" value={plan ? usdCompact(budget) : "No plan"} detail="Cost-head budgets from the selected version" />
        <PlanKpi title="Classified operating payments" value={usdCompact(actual)} detail={`${tx.length} actual payments in year and filters`} />
        <PlanKpi title="Planned sales target" value={plan ? usd(plannedSales) : "No plan"} detail="Monthly targets in the approved plan, not actual sales" />
        <PlanKpi title="Planned collections target" value={plan ? usd(plannedCollections) : "No plan"} detail="Monthly targets in the approved plan, not actual receipts" />
        <PlanKpi title="Budget status" value={plan ? plan.status : "Missing"} detail="Approved budgets are not overwritten by new draft uploads" />
        <PlanKpi title="Cost heads planned" value={String(heads.length)} detail="Editable through a new version upload" />
      </div>

      <div className="mt-4">
        <WidgetCard title="Monthly targets, November to October" icon={CalendarRange}>
          <p className="mb-3 text-[11px] text-ink-500">
            Planned sales and collections come from the annual Excel file. They are not actual sales or actual
            receipts.
          </p>
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Month</th>
                  <th className="px-3 py-2 text-right">Sales target</th>
                  <th className="px-3 py-2 text-right">Collections target</th>
                  <th className="px-3 py-2 text-right">Cost-head budget</th>
                </tr>
              </thead>
              <tbody>
                {monthlyRows.map((row) => (
                  <tr key={row.month} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="px-3 py-2 text-ink-50">{mo(row.month)}</td>
                    <td className="px-3 py-2 text-right">{row.sales !== null ? usd(row.sales) : "Not entered"}</td>
                    <td className="px-3 py-2 text-right">{row.collections !== null ? usd(row.collections) : "Not entered"}</td>
                    <td className="px-3 py-2 text-right">{row.budget !== null ? usd(row.budget) : "Not entered"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WidgetCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WidgetCard title="Plan split by department" icon={PieChartIcon}>
          {plan && donutData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  cursor="pointer"
                  onClick={(_, i) => {
                    const d = donutData[i];
                    if (d) router.push(`/finance/explorer?department=${encodeURIComponent(d.name)}`);
                  }}
                >
                  {donutData.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "rgb(var(--base-800))", color: "rgb(var(--ink-50))", border: "1px solid rgb(var(--base-700))", fontSize: 11 }}
                  formatter={(value, name) => [usd(Number(value ?? 0)), String(name)]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-xs text-ink-500">
              {plan ? "There is no spending in this selection. Change the filters above." : "Upload a plan to see the budget allocation."}
            </p>
          )}
        </WidgetCard>

        <WidgetCard title="Compare departments" icon={ListChecks}>
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2 text-right">Planned budget</th>
                  <th className="px-3 py-2 text-right">Recorded spending</th>
                </tr>
              </thead>
              <tbody>
                {deptMore.visible.map((r) => (
                  <tr key={r.dept} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="px-3 py-2 text-ink-50">{r.dept}</td>
                    <td className="px-3 py-2 text-right">{plan ? usd(r.budget) : "Not available"}</td>
                    <td className="px-3 py-2 text-right">{usd(r.actual)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ShowMoreBar state={deptMore} />
          <p className="mt-2 text-[11px] text-ink-500">
            A full-year plan versus part-year actuals is not a budget variance. Budget variance is calculated only
            for periods with actual transaction data.
          </p>
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard
          title="Cost-head plan and actuals"
          icon={ClipboardList}
          action={
            <button
              onClick={handleExport}
              className="flex items-center gap-1 rounded-lg border border-base-700 px-2.5 py-1.5 text-[11px] font-medium text-ink-300 hover:bg-base-800"
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.75} /> Export visible budget lines
            </button>
          }
        >
          <p className="mb-3 text-[11px] text-ink-500">
            The cost-head table responds to the selected FY, department and month filters. Click a cost head to
            inspect its recorded payments.
          </p>
          {heads.length > 10 && (
            <div className="mb-2">
              <ListSearch value={headSearch.query} onChange={headSearch.setQuery} placeholder="Find a department or cost head…" />
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Cost head</th>
                  <th className="px-3 py-2 text-right">Full selected-period plan</th>
                  <th className="px-3 py-2 text-right">Recorded actual</th>
                </tr>
              </thead>
              <tbody>
                {headMore.visible.map((r) => (
                  <tr key={`${r.department} | ${r.head}`} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="px-3 py-2">{r.department}</td>
                    <td className="px-3 py-2 text-ink-50">
                      <button
                        onClick={() =>
                          router.push(
                            `/finance/payments?mode=operating&department=${encodeURIComponent(r.department)}&costHead=${encodeURIComponent(r.head)}&fy=${year}`
                          )
                        }
                        className="hover:underline"
                      >
                        {r.head} ↗
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right">{usd(r.budget)}</td>
                    <td className="px-3 py-2 text-right">{usd(r.actual)}</td>
                  </tr>
                ))}
                {heads.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-ink-500">
                      No plan uploaded for this year.
                    </td>
                  </tr>
                )}
                {heads.length > 0 && headSearch.filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-ink-500">
                      No cost heads match &ldquo;{headSearch.query}&rdquo;.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <ShowMoreBar state={headMore} />
        </WidgetCard>
      </div>

      <div className="mt-4">
        <WidgetCard title="Year-on-year planning" icon={CalendarRange}>
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Financial year</th>
                  <th className="px-3 py-2">Latest approved version</th>
                  <th className="px-3 py-2 text-right">Annual budget</th>
                  <th className="px-3 py-2 text-right">Recorded operating spend</th>
                </tr>
              </thead>
              <tbody>
                {yearRows.map((r) => (
                  <tr key={r.fy} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="px-3 py-2 font-medium text-ink-50">
                      <button
                        onClick={() => {
                          setSelectedPlanId("");
                          setFilters({ fy: String(r.fy), start: "all", end: "all" });
                        }}
                        className="hover:underline"
                      >
                        {fyName(r.fy)}
                      </button>
                    </td>
                    <td className="px-3 py-2">{r.plan ? `v${r.plan.version}` : "Not approved"}</td>
                    <td className="px-3 py-2 text-right">{r.annualBudget !== null ? usd(r.annualBudget) : "Not available"}</td>
                    <td className="px-3 py-2 text-right">{usd(r.spend)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-ink-500">
            Year-on-year totals are not necessarily comparable until the entire FY has been imported and cost heads
            are consistently classified.
          </p>
        </WidgetCard>
      </div>

      {showPlanModal && (
        <CreatePlanModal
          departments={departments}
          costHeads={costHeads}
          defaultYear={year}
          onClose={() => setShowPlanModal(false)}
          onCreated={async () => {
            setShowPlanModal(false);
            await reload();
          }}
        />
      )}
    </div>
  );
}


function CreatePlanModal({
  departments,
  costHeads,
  defaultYear,
  onClose,
  onCreated,
}: {
  departments: string[];
  costHeads: string[];
  defaultYear: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [mode, setMode] = useState<"manual" | "upload">("manual");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-base-700 bg-base-900 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink-50">Create or revise the financial plan</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-300">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mb-4 inline-flex rounded-lg border border-base-700 bg-base-900 p-0.5">
          {(["manual", "upload"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setMode(v)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                mode === v ? "bg-base-800 text-ink-50" : "text-ink-500 hover:text-ink-300"
              }`}
            >
              {v === "manual" ? "Enter manually" : "Upload workbook"}
            </button>
          ))}
        </div>
        {mode === "manual" ? (
          <CreateApprovedYearForm departments={departments} costHeads={costHeads} defaultYear={defaultYear} onCreated={onCreated} />
        ) : (
          <UploadPlanForm defaultYear={defaultYear} onCommitted={onCreated} />
        )}
      </div>
    </div>
  );
}

function CreateApprovedYearForm({
  departments,
  costHeads,
  defaultYear,
  onCreated,
}: {
  departments: string[];
  costHeads: string[];
  defaultYear: number;
  onCreated: () => void;
}) {
  const [year, setYear] = useState(String(defaultYear));
  const [name, setName] = useState("");
  const [revisionReason, setRevisionReason] = useState("");
  const [annualCollectionsUsd, setAnnualCollectionsUsd] = useState("");
  const [annualSalesUsd, setAnnualSalesUsd] = useState("");
  const [rows, setRows] = useState<BudgetRowDraft[]>([
    { department: departments[0] ?? "", costHead: costHeads[0] ?? "", annualBudgetUsd: "" },
  ]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function updateRow(i: number, patch: Partial<BudgetRowDraft>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, { department: departments[0] ?? "", costHead: costHeads[0] ?? "", annualBudgetUsd: "" }]);
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/finance/plans/create-year", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: Number(year),
          name: name || undefined,
          revisionReason: revisionReason || undefined,
          confirmLock: true,
          annualCollectionsUsd: annualCollectionsUsd === "" ? undefined : Number(annualCollectionsUsd),
          annualSalesUsd: annualSalesUsd === "" ? undefined : Number(annualSalesUsd),
          budgets: rows
            .filter((r) => r.department && r.costHead && r.annualBudgetUsd !== "")
            .map((r) => ({
              department: r.department,
              costHead: r.costHead,
              annualBudgetUsd: Number(r.annualBudgetUsd),
            })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to create plan");
      }
      setSuccess(`${data.fy} approved with ${data.heads} budget lines, ${usd(data.spendingBudgetUsd)} total.`);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5">
      <div className="flex gap-2">
        <input
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder="Fiscal year, e.g. 2027"
          type="number"
          className={inputClass}
        />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Plan name (optional)" className={inputClass} />
      </div>
      <div className="flex gap-2">
        <input
          value={annualCollectionsUsd}
          onChange={(e) => setAnnualCollectionsUsd(e.target.value)}
          placeholder="Annual collections target USD"
          type="number"
          className={inputClass}
        />
        <input
          value={annualSalesUsd}
          onChange={(e) => setAnnualSalesUsd(e.target.value)}
          placeholder="Annual sales target USD (optional)"
          type="number"
          className={inputClass}
        />
      </div>
      <input
        value={revisionReason}
        onChange={(e) => setRevisionReason(e.target.value)}
        placeholder="Revision reason (required if this FY already has an approved plan)"
        className={inputClass}
      />

      <div className="space-y-2 rounded-lg border border-base-700 bg-base-800/40 p-2.5">
        <p className="text-[11px] font-medium text-ink-500">Department / Cost Head Budgets</p>
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <select value={row.department} onChange={(e) => updateRow(i, { department: e.target.value })} className={inputClass}>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select value={row.costHead} onChange={(e) => updateRow(i, { costHead: e.target.value })} className={inputClass}>
              {costHeads.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              value={row.annualBudgetUsd}
              onChange={(e) => updateRow(i, { annualBudgetUsd: e.target.value })}
              placeholder="Annual USD"
              type="number"
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => removeRow(i)}
              disabled={rows.length === 1}
              className="shrink-0 rounded-lg border border-base-700 p-2 text-ink-500 hover:text-status-inactive disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-1 rounded-lg border border-base-700 px-2 py-1 text-[11px] text-ink-300 hover:bg-base-800"
        >
          <Plus className="h-3 w-3" strokeWidth={1.75} /> Add line
        </button>
      </div>

      {error && <p className="text-xs text-status-inactive">{error}</p>}
      {success && <p className="text-xs text-status-active">{success}</p>}
      <button
        type="submit"
        disabled={isSaving || !year}
        className="w-full rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
      >
        {isSaving ? "Creating…" : "Create & approve year"}
      </button>
    </form>
  );
}

function UploadPlanForm({ defaultYear, onCommitted }: { defaultYear: number; onCommitted: () => void }) {
  const [fy, setFy] = useState(String(defaultYear));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<{ id: string; fy: string; version: number } | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  async function handlePreview(e: React.FormEvent) {
    e.preventDefault();
    if (!file || isPreviewing) return;
    setIsPreviewing(true);
    setPreviewError(null);
    setPreview(null);
    setCommitResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("fy", fy);
      const res = await fetch("/api/finance/plans/preview", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Preview failed");
      setPreview(data);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleCommit() {
    if (!preview || isCommitting) return;
    setIsCommitting(true);
    setCommitError(null);
    try {
      const res = await fetch("/api/finance/plans/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: preview.token }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Commit failed");
      setCommitResult(data);
      setPreview(null);
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsCommitting(false);
    }
  }

  async function handleApproveCommitted() {
    if (!commitResult) return;
    const res = await fetch("/api/finance/plans/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: commitResult.id }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setCommitError(data?.error ?? "Approve failed");
      return;
    }
    setCommitResult(null);
    onCommitted();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 rounded-lg border border-base-700 bg-base-800/40 p-2.5">
        <div>
          <p className="text-xs text-ink-300">Blank workbook template</p>
          <p className="text-[11px] text-ink-500">Summary + Cost Head Budgets sheets, Nov–Oct.</p>
        </div>
        <a
          href={`/api/finance/plans/template?fy=${encodeURIComponent(fy)}`}
          download
          className="flex items-center gap-1 rounded-lg border border-base-700 px-2.5 py-1.5 text-[11px] font-medium text-ink-300 hover:bg-base-800"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={1.75} /> Download
        </a>
      </div>

      <form onSubmit={handlePreview} className="space-y-2.5">
        <div className="flex gap-2">
          <input value={fy} onChange={(e) => setFy(e.target.value)} type="number" placeholder="Fiscal year" className={inputClass} />
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-lg border border-base-700 bg-base-800 px-3 py-1.5 text-xs text-ink-50 outline-none file:mr-2 file:rounded-md file:border-0 file:bg-base-700 file:px-2 file:py-1 file:text-ink-300"
          />
        </div>
        {previewError && <p className="text-xs text-status-inactive">{previewError}</p>}
        <button
          type="submit"
          disabled={!file || isPreviewing}
          className="w-full rounded-lg border border-base-700 py-2 text-xs font-medium text-ink-300 hover:bg-base-800 disabled:opacity-50"
        >
          {isPreviewing ? "Validating…" : "Preview upload"}
        </button>
      </form>

      {preview && (
        <div className="space-y-2 rounded-lg border border-base-700 bg-base-800/40 p-2.5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="Valid rows" value={preview.valid.toLocaleString()} />
            <Tile label="Invalid rows" value={preview.invalid.toLocaleString()} />
            <Tile label="Total" value={usd(preview.totalUsd)} />
            <Tile label="Format" value={preview.format} />
          </div>
          {preview.issues.length > 0 && (
            <div className="rounded-lg border border-status-alert/40 bg-status-alert/10 p-2 text-[11px] text-status-alert">
              <div className="mb-1 flex items-center gap-1 font-medium">
                <AlertTriangle className="h-3 w-3" strokeWidth={1.75} /> {preview.issues.length} issue(s)
              </div>
              <ul className="max-h-28 space-y-0.5 overflow-y-auto">
                {preview.issues.slice(0, 10).map((issue, i) => (
                  <li key={i}>
                    Row {issue.row}: {issue.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {commitError && <p className="text-xs text-status-inactive">{commitError}</p>}
          <button
            onClick={handleCommit}
            disabled={!preview.ready || isCommitting}
            className="w-full rounded-lg bg-ink-50 py-2 text-xs font-medium text-base-950 hover:bg-white disabled:opacity-50"
          >
            {isCommitting ? "Committing…" : preview.ready ? "Commit as Draft" : "Fix issues before committing"}
          </button>
        </div>
      )}

      {commitResult && (
        <div className="flex items-center justify-between rounded-lg border border-status-active/40 bg-status-active/10 p-2.5 text-xs text-status-active">
          <span>
            {commitResult.fy} v{commitResult.version} committed as Draft.
          </span>
          <button
            onClick={handleApproveCommitted}
            className="rounded-lg border border-status-active/40 px-2 py-1 text-[11px] font-medium hover:bg-status-active/20"
          >
            Approve now
          </button>
        </div>
      )}
    </div>
  );
}
