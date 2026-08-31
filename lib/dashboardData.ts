// Real dashboard metrics now come from lib/dashboardMetrics.ts (computed
// from real Lead/Opportunity/LeadTimelineEvent data) — the static mock
// arrays that used to live here have been removed.

export function formatCurrency(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}