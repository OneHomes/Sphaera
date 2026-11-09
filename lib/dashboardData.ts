// Real dashboard metrics now come from lib/dashboardMetrics.ts (computed
// from real Lead/Opportunity/LeadTimelineEvent data) — the static mock
// arrays that used to live here have been removed.
import { formatMoney } from "./money";

export function formatCurrency(value: number): string {
  return formatMoney(value, { decimals: 2 });
}