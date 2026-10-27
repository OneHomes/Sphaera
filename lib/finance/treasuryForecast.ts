import { projection } from "./creditCycleData";
import { getTreasuryState } from "./treasuryData";

// Source /api/treasury/state always folds a 3-month credit projection into treasury.state(),
// so bank commitments reflect known invoices, recurring bills and card cycles.
export async function getTreasuryStateWithForecast(includePayroll: boolean) {
  const cr = await projection({ months: 3, includePayroll });
  return getTreasuryState(cr);
}

/** Source /api/treasury/forecast: outgoing credit-cycle events plus pending processor payouts in the horizon. */
export async function getTreasuryForecast(months: 1 | 3 | 12, includePayroll: boolean) {
  const cr = await projection({ months, includePayroll });
  const state = await getTreasuryState(cr);
  const incoming = state.pendingSettlements
    .filter((p) => p.expectedDate)
    .map((p) => ({
      bankAccountId: p.bankAccountId,
      date: new Date(p.expectedDate!).toISOString().slice(0, 10),
      currency: p.currency,
      amount: p.net,
      provider: p.provider,
      status: p.status,
    }))
    .filter((p) => cr.from <= p.date && p.date <= cr.to);
  return { from: cr.from, to: cr.to, outgoing: cr.events, incoming };
}
