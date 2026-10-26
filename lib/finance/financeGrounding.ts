import { getFinanceState } from "./ledgerData";

// Grounding context for the Finance "Ask Your Data" assistant — direct
// port of the source app's select_analytics(kind='overview') summary
// shape (server.py ~1794-1833), preserving its explicit caution notes
// verbatim rather than paraphrasing them away: these exist specifically
// to stop the AI (and a reader) from over-interpreting cash-basis ledger
// figures as GAAP/sales figures.

export async function getFinanceAnalyticsSummary(): Promise<string> {
  const state = await getFinanceState();
  const { transactions, monthly, departments } = state;

  const activeDepartments = new Set(departments);
  const operating = transactions.filter(
    (t) => t.managementDepartment && activeDepartments.has(t.managementDepartment) && t.debtPeriod === "current"
  );
  const debt = transactions.filter((t) => t.debtPeriod !== "current");
  const unidentified = transactions.filter((t) => !t.managementDepartment);

  const sum = (rows: typeof transactions) => Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;

  const spendByDepartment = new Map<string, number>();
  for (const t of transactions) {
    const key = t.managementDepartment ?? "Unallocated";
    spendByDepartment.set(key, (spendByDepartment.get(key) ?? 0) + t.amount);
  }
  const topDepartments = Array.from(spendByDepartment.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([dept, usd]) => `${dept}: $${Math.round(usd).toLocaleString()}`);

  const budget = Math.round(monthly.reduce((s, m) => s + m.opexBudget, 0) * 100) / 100;
  const collections = Math.round(monthly.reduce((s, m) => s + m.collections, 0) * 100) / 100;

  const monthPerformance = monthly.map((m) => {
    const monthOperating = sum(operating.filter((r) => r.month === m.month));
    const monthDebt = sum(debt.filter((r) => r.month === m.month));
    return `${m.month}: collections $${Math.round(m.collections).toLocaleString()}, budget $${Math.round(
      m.opexBudget
    ).toLocaleString()}, operating spend $${Math.round(monthOperating).toLocaleString()}, historical debt $${Math.round(
      monthDebt
    ).toLocaleString()}`;
  });

  return `
FINANCE OVERVIEW (${transactions.length} ledger payments total)
Total ledger movements: $${Math.round(sum(transactions)).toLocaleString()}
Current operating spend: $${Math.round(sum(operating)).toLocaleString()}
Historical debt paid: $${Math.round(sum(debt)).toLocaleString()} (${debt.length} payments)
Unidentified/unclassified payments: ${unidentified.length}, totaling $${Math.round(sum(unidentified)).toLocaleString()}
Collections (all recorded months): $${collections.toLocaleString()}
Budget (all recorded months with a budget set): $${budget.toLocaleString()}

Top spend by department:
${topDepartments.join("\n") || "- No classified spend yet"}

Month-by-month performance:
${monthPerformance.join("\n") || "- No monthly figures recorded yet"}

IMPORTANT CAUTIONS (state these whenever relevant to the question, do not omit):
- Collections are cash receipts, not sales revenue — never describe them as "sales" or "revenue earned."
- Not every ledger movement is an operating cost; some are historical debt repayments, balance-sheet transfers, or unclassified.
- "Historical debt" tags are internal management classifications, not legal loan repayment records.
- Payroll/personnel names and individual compensation figures are deliberately withheld from this summary — never speculate about any specific person's pay.
`.trim();
}
