"use client";

import { useMemo, useState } from "react";
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

type TransactionRow = {
  managementDepartment: string | null;
  managementCostHead: string | null;
  amount: number;
  month: string;
  debtPeriod: string;
};

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

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[(m ?? 1) - 1]} ${y}`;
}

function usd(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
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

function StatusBadge({ status }: { status: string }) {
  const style =
    status === "Approved"
      ? "bg-status-active/15 text-status-active"
      : status === "Missing"
        ? "bg-base-700 text-ink-500"
        : "bg-status-alert/15 text-status-alert";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${style}`}>{status}</span>;
}

const inputClass =
  "w-full rounded-lg border border-base-700 bg-base-800 px-3 py-2 text-xs text-ink-50 outline-none placeholder:text-ink-500";

export function FinancialPlanningPage({
  plans: initialPlans,
  lines: initialLines,
  targets: initialTargets,
  departments,
  costHeads,
  transactions,
}: {
  plans: PlanRow[];
  lines: PlanLineRow[];
  targets: PlanTargetRow[];
  departments: string[];
  costHeads: string[];
  transactions: TransactionRow[];
}) {
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

  // `plans` is already sorted fyStart desc, version desc (financePlanData()).
  const latestApproved = plans.find((p) => p.status === "Approved") ?? null;
  const selectedPlan = selectedPlanId
    ? plans.find((p) => p.id === selectedPlanId) ?? null
    : latestApproved ?? plans[0] ?? null;

  const headerFyStart = selectedPlan?.fyStart ?? fiscalYearStartFromDate(new Date());
  const fyMonths = useMemo(() => fiscalYearMonths(headerFyStart), [headerFyStart]);
  const fyMonthSet = useMemo(() => new Set(fyMonths), [fyMonths]);
  const activeDeptSet = useMemo(() => new Set(departments), [departments]);

  const planLines = useMemo(
    () => (selectedPlan ? lines.filter((l) => l.planId === selectedPlan.id) : []),
    [lines, selectedPlan]
  );
  const planTargets = useMemo(
    () => (selectedPlan ? targets.filter((t) => t.planId === selectedPlan.id) : []),
    [targets, selectedPlan]
  );

  const budgetTotal = planLines.reduce((s, l) => s + l.budgetUsd, 0);
  const salesTotal = planTargets.reduce((s, t) => s + t.salesTargetUsd, 0);
  const collectionsTotal = planTargets.reduce((s, t) => s + t.collectionsTargetUsd, 0);
  const distinctCostHeads = new Set(planLines.map((l) => l.costHead));

  const operatingInFy = useMemo(
    () =>
      transactions.filter(
        (t) =>
          t.debtPeriod === "current" &&
          t.managementDepartment &&
          activeDeptSet.has(t.managementDepartment) &&
          fyMonthSet.has(t.month)
      ),
    [transactions, activeDeptSet, fyMonthSet]
  );
  const actualOpex = operatingInFy.reduce((s, t) => s + t.amount, 0);

  const budgetByDept = new Map<string, number>();
  for (const l of planLines) budgetByDept.set(l.department, (budgetByDept.get(l.department) ?? 0) + l.budgetUsd);
  const actualByDept = new Map<string, number>();
  for (const t of operatingInFy) {
    const key = t.managementDepartment!;
    actualByDept.set(key, (actualByDept.get(key) ?? 0) + t.amount);
  }
  const deptCompareRows = Array.from(new Set([...budgetByDept.keys(), ...actualByDept.keys()]))
    .map((d) => ({ department: d, planned: budgetByDept.get(d) ?? 0, actual: actualByDept.get(d) ?? 0 }))
    .sort((a, b) => b.planned - a.planned);
  const donutData = deptCompareRows.filter((r) => r.planned > 0).map((r) => ({ name: r.department, value: r.planned }));

  const actualByKey = new Map<string, number>();
  for (const t of operatingInFy) {
    if (!t.managementCostHead || !t.managementDepartment) continue;
    const key = `${t.managementDepartment}\u0000${t.managementCostHead}`;
    actualByKey.set(key, (actualByKey.get(key) ?? 0) + t.amount);
  }
  const planByKey = new Map<string, { department: string; costHead: string; amount: number }>();
  for (const l of planLines) {
    const key = `${l.department}\u0000${l.costHead}`;
    const cur = planByKey.get(key) ?? { department: l.department, costHead: l.costHead, amount: 0 };
    cur.amount += l.budgetUsd;
    planByKey.set(key, cur);
  }
  const costHeadRows = Array.from(planByKey.entries())
    .map(([key, r]) => ({ ...r, actual: actualByKey.get(key) ?? 0 }))
    .sort((a, b) => a.department.localeCompare(b.department) || a.costHead.localeCompare(b.costHead));

  const monthlyRows = fyMonths.map((m) => {
    const target = planTargets.find((t) => t.month === m);
    const hasBudgetLines = planLines.some((l) => l.month === m);
    const monthBudget = hasBudgetLines ? planLines.filter((l) => l.month === m).reduce((s, l) => s + l.budgetUsd, 0) : null;
    return {
      month: m,
      sales: target ? target.salesTargetUsd : null,
      collections: target ? target.collectionsTargetUsd : null,
      budget: monthBudget,
    };
  });

  const fyStarts = Array.from(new Set(plans.map((p) => p.fyStart))).sort((a, b) => b - a);
  const yearRows = fyStarts.map((fy) => {
    const versionsForFy = plans.filter((p) => p.fyStart === fy); // desc version order
    const approvedForFy = versionsForFy.find((p) => p.status === "Approved");
    const latestVersion = versionsForFy[0];
    const basisPlan = approvedForFy ?? latestVersion;
    const basisLines = lines.filter((l) => l.planId === basisPlan.id);
    const annualBudget = basisLines.reduce((s, l) => s + l.budgetUsd, 0);
    const months = new Set(fiscalYearMonths(fy));
    const spend = transactions
      .filter((t) => t.debtPeriod === "current" && t.managementDepartment && activeDeptSet.has(t.managementDepartment) && months.has(t.month))
      .reduce((s, t) => s + t.amount, 0);
    return {
      fy,
      latestVersionLabel: `v${latestVersion.version} ${latestVersion.status}`,
      annualBudget: approvedForFy ? annualBudget : null,
      spend,
    };
  });

  function handleExport() {
    const header = ["Department", "Cost Head", "Plan (selected period)", "Recorded actual"];
    const rows = [header, ...costHeadRows.map((r) => [r.department, r.costHead, r.amount.toFixed(2), r.actual.toFixed(2)])];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `budget-lines-${fyName(headerFyStart)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const canRevise = latestApproved !== null && latestApproved.fyStart === headerFyStart;

  return (
    <div className="p-6">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-ink-50">
          Financial planning, {fyName(headerFyStart)}
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Approved November to October targets and spending budgets. Actual spending comes from the ERP,
          independently of your plan.
        </p>
      </div>

      <WidgetCard title="Financial year control" icon={CalendarRange}>
        <p className="text-xs text-ink-500">
          Enter the new year&apos;s targets directly, review them and lock the approved version in the SQL database.
          No Excel upload required.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowPlanModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-2 text-xs font-medium text-base-950 hover:bg-white"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            {canRevise ? "Create a revised plan" : "Start new financial year"}
          </button>
          <select
            value={selectedPlanId}
            onChange={(e) => setSelectedPlanId(e.target.value)}
            className="rounded-lg border border-base-700 bg-base-800 px-2 py-2 text-xs text-ink-50 outline-none"
          >
            <option value="">Latest approved plan</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {fyName(p.fyStart)} v{p.version} {p.status}
              </option>
            ))}
          </select>
          <StatusBadge status={selectedPlan?.status ?? "Missing"} />
        </div>
        <p className="mt-2 text-[11px] text-ink-600">
          Approved figures cannot be edited. Revisions create a new numbered version and preserve the previous
          approved figures.
        </p>
      </WidgetCard>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <WidgetCard title="Budget in selected view" icon={Banknote}>
          <Tile
            label={selectedPlan ? `${fyName(selectedPlan.fyStart)} v${selectedPlan.version}` : "No plan"}
            value={selectedPlan ? usd(budgetTotal) : "No plan"}
          />
        </WidgetCard>
        <WidgetCard title="Classified operating payments" icon={ListChecks}>
          <Tile label={`${operatingInFy.length.toLocaleString()} payments`} value={usd(actualOpex)} />
        </WidgetCard>
        <WidgetCard title="Planned sales target" icon={Target}>
          <Tile label="Annual target" value={selectedPlan && planTargets.length ? usd(salesTotal) : "No plan"} />
        </WidgetCard>
        <WidgetCard title="Planned collections target" icon={Target}>
          <Tile label="Annual target" value={selectedPlan && planTargets.length ? usd(collectionsTotal) : "No plan"} />
        </WidgetCard>
        <WidgetCard title="Budget status" icon={CheckCircle2}>
          <div className="flex h-full items-center">
            <StatusBadge status={selectedPlan?.status ?? "Missing"} />
          </div>
        </WidgetCard>
        <WidgetCard title="Cost heads planned" icon={ClipboardList}>
          <Tile label="Distinct cost heads in this plan" value={String(distinctCostHeads.size)} />
        </WidgetCard>
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
                  <th className="px-3 py-2">Sales target</th>
                  <th className="px-3 py-2">Collections target</th>
                  <th className="px-3 py-2">Cost-head budget</th>
                </tr>
              </thead>
              <tbody>
                {monthlyRows.map((row) => (
                  <tr key={row.month} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="px-3 py-2 text-ink-50">{monthLabel(row.month)}</td>
                    <td className="px-3 py-2">{row.sales !== null ? usd(row.sales) : "Not entered"}</td>
                    <td className="px-3 py-2">{row.collections !== null ? usd(row.collections) : "Not entered"}</td>
                    <td className="px-3 py-2">{row.budget !== null ? usd(row.budget) : "Not entered"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WidgetCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <WidgetCard title="Plan split by department" icon={PieChartIcon}>
          {donutData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85}>
                  {donutData.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#1a1a1d", border: "1px solid #232327", fontSize: 11 }}
                  formatter={(value, name) => [usd(Number(value ?? 0)), String(name)]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-ink-500">No budget lines in the selected plan.</p>
          )}
        </WidgetCard>

        <WidgetCard title="Compare departments" icon={ListChecks}>
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Planned budget</th>
                  <th className="px-3 py-2">Recorded spending</th>
                </tr>
              </thead>
              <tbody>
                {deptCompareRows.map((r) => (
                  <tr key={r.department} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="px-3 py-2 text-ink-50">{r.department}</td>
                    <td className="px-3 py-2">{usd(r.planned)}</td>
                    <td className="px-3 py-2">{usd(r.actual)}</td>
                  </tr>
                ))}
                {deptCompareRows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-ink-500">
                      No department figures for this plan yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
          <div className="overflow-x-auto rounded-xl border border-base-700">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-base-700 bg-base-900 text-ink-500">
                <tr>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">Cost head</th>
                  <th className="px-3 py-2">Full selected-period plan</th>
                  <th className="px-3 py-2">Recorded actual</th>
                </tr>
              </thead>
              <tbody>
                {costHeadRows.map((r) => (
                  <tr key={`${r.department}\u0000${r.costHead}`} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="px-3 py-2">{r.department}</td>
                    <td className="px-3 py-2 text-ink-50">{r.costHead}</td>
                    <td className="px-3 py-2">{usd(r.amount)}</td>
                    <td className="px-3 py-2">{usd(r.actual)}</td>
                  </tr>
                ))}
                {costHeadRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-ink-500">
                      No cost-head budget lines in this plan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-ink-500">
            Click a cost head on the Spending Explorer to inspect each payment behind these totals.
          </p>
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
                  <th className="px-3 py-2">Annual budget</th>
                  <th className="px-3 py-2">Recorded operating spend</th>
                </tr>
              </thead>
              <tbody>
                {yearRows.map((r) => (
                  <tr key={r.fy} className="border-b border-base-800 text-ink-300 last:border-0">
                    <td className="px-3 py-2 text-ink-50">{fyName(r.fy)}</td>
                    <td className="px-3 py-2">{r.latestVersionLabel}</td>
                    <td className="px-3 py-2">{r.annualBudget !== null ? usd(r.annualBudget) : "No approved plan"}</td>
                    <td className="px-3 py-2">{usd(r.spend)}</td>
                  </tr>
                ))}
                {yearRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-ink-500">
                      No financial years recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-ink-500">
            Year-on-year totals are not comparable until a full financial year has been imported.
          </p>
        </WidgetCard>
      </div>

      {showPlanModal && (
        <CreatePlanModal
          departments={departments}
          costHeads={costHeads}
          defaultYear={canRevise ? headerFyStart + 1 : headerFyStart}
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
