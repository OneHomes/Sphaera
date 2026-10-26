import { NextResponse } from "next/server";
import { getTreasuryState } from "@/lib/finance/treasuryData";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

// The full treasury rollup (per-bank balance/allocation/reconciliation
// state, per-fund USD totals, recent movements/settlements) — direct
// equivalent of the source Python app's treasury state() endpoint.
//
// getTreasuryState() optionally takes an externally-computed
// `creditForecast` (future invoice/recurring-charge events), which the
// source app builds from its own credit-forecast sub-domain before calling
// state(). That sub-domain isn't wired up in this stage of the port, so
// this route calls getTreasuryState() with no argument — same as the
// source's own `credit_forecast=None` default — which yields commitments
// of zero rather than omitting the field. Wiring a real forecast feed in
// here is a follow-up once that sub-domain lands.
export async function GET() {
  try {
    return await withTenant(async (authUser) => {
      if (!authUser.canAccessFinance) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const state = await getTreasuryState();
      return NextResponse.json(state);
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
