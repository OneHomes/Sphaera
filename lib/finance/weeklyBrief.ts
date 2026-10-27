import { getFinanceState } from "./ledgerData";
import { projection } from "./creditCycleData";
import { fyOf } from "./financeFilters";
import type { FinanceLedgerRow } from "./ledgerData";

type Slice = { amount: number; managementDepartment: string | null };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;
const fyName = (y: number) => `FY${y}/${String((y + 1) % 100).padStart(2, "0")}`;

/** Port of the source weekly_brief(year). */
export async function getWeeklyBrief(year: number, departmentScope?: string[] | null) {
  if (!(year >= 2015 && year <= 2050)) throw new Error("Invalid FY");
  const state = await getFinanceState(departmentScope);
  const departments = state.departments;
  const payments = state.transactions.filter((x) => fyOf(x.month) === year);

  const expand = (rows: FinanceLedgerRow[]): Slice[] => {
    const out: Slice[] = [];
    for (const row of rows) {
      if (row.debtPeriod !== "current") continue;
      if (row.departmentSplits?.length) {
        for (const part of row.departmentSplits) out.push({ amount: part.amountUsd, managementDepartment: part.department });
      } else if (row.managementDepartment && departments.includes(row.managementDepartment)) {
        out.push(row);
      }
    }
    return out;
  };
  const sum = (rows: { amount: number }[]) => round2(rows.reduce((s, x) => s + x.amount, 0));

  const actual = expand(payments);
  const plan = state.approvedPlans.find((p) => p.fyStart === year) ?? null;
  const today = new Date();
  const weekStart = new Date(today.getTime() - 6 * 86400000);
  const recent = payments.filter((x) => {
    const d = iso(new Date(x.date));
    return iso(weekStart) <= d && d <= iso(today);
  });

  const cash = await projection({ start: iso(today), months: 1, includePayroll: false });
  const twoWeeks = iso(new Date(today.getTime() + 14 * 86400000));
  const coming = cash.events
    .filter((x) => x.date <= twoWeeks)
    .slice(0, 40)
    .map((x) => ({
      date: x.date,
      title: x.kind !== "Salary" ? x.label : "Payroll",
      kind: x.kind,
      amount: x.amount,
      currency: x.currency,
      certainty: x.certainty,
    }));

  return {
    creditCycle: {
      dueNext14Days: coming,
      overdueCount: cash.overdue.length,
      unassignedBankCount: cash.unassignedCount,
      unconfirmedCardStatements: cash.cycles.filter((x) => x.amountDue === null).length,
      note: "Only known obligations. Excludes projected collection inflows and unconfirmed future expenses.",
    },
    fy: fyName(year),
    weekStart: iso(weekStart),
    weekEnd: iso(today),
    last7DaysPayments: recent.length,
    last7DaysOperatingUsd: sum(expand(recent)),
    last7DaysDebtUsd: sum(recent.filter((x) => x.debtPeriod !== "current")),
    generatedAt: new Date().toISOString(),
    reportingScope: "FY-to-date records currently available in Sphaera, not necessarily fully reconciled ERP transactions",
    payments: payments.length,
    actualUsd: sum(actual),
    historicalDebtUsd: sum(payments.filter((x) => x.debtPeriod !== "current")),
    unallocatedCount: payments.filter((x) => !x.departmentSplits?.length && (!x.managementDepartment || !x.managementCostHead)).length,
    budgetVersion: plan ? plan.version : null,
    departments: departments.map((dept) => ({
      department: dept,
      actualUsd: sum(actual.filter((x) => x.managementDepartment === dept)),
      approvedBudgetUsd: plan ? round2(plan.lines.filter((l) => l.department === dept).reduce((s, l) => s + l.budgetUsd, 0)) : null,
    })),
    emailDelivery: "Not configured; requires company email integration and a continuously running hosted service.",
  };
}

export type WeeklyBrief = Awaited<ReturnType<typeof getWeeklyBrief>>;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (n: number | null) => (n === null ? "Not supplied" : `$${Math.round(n).toLocaleString("en-US")}`);

/** Port of the source weekly_html(report), re-skinned to Sphaera's dark palette (white when printed). */
export function weeklyBriefHtml(r: WeeklyBrief): string {
  const rows = r.departments
    .map((d) => `<tr><td>${esc(d.department)}</td><td>${money(d.approvedBudgetUsd)}</td><td>${money(d.actualUsd)}</td></tr>`)
    .join("");
  const creditRows = r.creditCycle.dueNext14Days
    .map(
      (x) =>
        `<tr><td>${esc(x.date)}</td><td>${esc(x.title)}</td><td>${esc(x.currency)} ${x.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td>${esc(x.certainty)}</td></tr>`
    )
    .join("");
  const card = (label: string, value: string) => `<div class="card">${label}<strong>${value}</strong></div>`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>One Homes CEO Weekly Brief</title>
<style>
body{font-family:Inter,Arial,sans-serif;background:#0a0a0b;color:#fafafa;max-width:1000px;margin:40px auto;padding:20px}
.card{background:#111113;border:1px solid #232327;border-radius:12px;padding:24px;margin:16px 0;color:#a1a1aa}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.grid strong{font-size:28px;display:block;margin-top:12px;color:#fafafa}
table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:12px;border-bottom:1px solid #232327}th{color:#71717a;font-weight:500}td{color:#fafafa}
h1{margin:0;font-size:22px;letter-spacing:.04em}h2{color:#fafafa;font-size:16px}p{color:#a1a1aa}small{color:#71717a}
@media print{body{background:white;color:#173348;margin:0}.card{background:white;border-color:#e0e6eb;color:#173348}.grid strong,td,h2{color:#173348}}
</style>
<h1>ONE HOMES · CEO FINANCIAL BRIEF</h1><p>${esc(r.fy)} | Week ${esc(r.weekStart)} to ${esc(r.weekEnd)}</p>
<div class="grid">${card("This week, classified costs", money(r.last7DaysOperatingUsd))}${card("This week, historical debt", money(r.last7DaysDebtUsd))}${card("Transactions this week", String(r.last7DaysPayments))}</div>
<div class="grid">${card("FY classified spending", money(r.actualUsd))}${card("FY historical debt paid", money(r.historicalDebtUsd))}${card("Payments requiring classification", String(r.unallocatedCount))}</div>
<div class="card"><h2>Department performance</h2><table><thead><tr><th>Department</th><th>Annual approved plan</th><th>Recorded FY spending</th></tr></thead><tbody>${rows}</tbody></table>
<p><small>Annual plan is not directly comparable with incomplete-year actuals. Budget version: ${r.budgetVersion ? String(r.budgetVersion) : "Not yet approved"}.</small></p></div>
<div class="card"><h2>Management attention</h2><p>Review cost-head allocations, historic debt classifications and any costs without supporting invoice or bank references. Do not treat collections as revenue or mixed bank balances as one currency total.</p></div>
<div class="card"><h2>Upcoming cash obligations, next 14 days</h2><p>Includes only scheduled obligations and confirmed or estimated card settlements, excludes future collections.</p>
<table><tr><th>Date</th><th>Obligation</th><th>Currency and amount</th><th>Basis</th></tr>${creditRows}</table>
<p><small>Overdue items: ${r.creditCycle.overdueCount}. Unassigned bank sources: ${r.creditCycle.unassignedBankCount}. Card statements needing verification: ${r.creditCycle.unconfirmedCardStatements}.</small></p></div>
<p><small>${esc(r.reportingScope)}. Generated ${esc(r.generatedAt)}. Automatic email delivery not connected.</small></p></html>`;
}
