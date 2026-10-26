import { prisma } from "../prisma";

// Treasury allocation sub-ledger and processor settlement staging, ported
// from the source Python app's treasury.py (One Homes treasury module).
// Native-currency-only accounting: USD rollups are only ever shown when a
// bank's own timestamped FX quote (usdPerUnit/fxAsOf) is present — this
// file never silently converts or sums mismatched currencies. Bank ERP
// snapshots (FinanceErpBankBalance) do not automatically become
// "allocated" funds; allocation only happens through postTreasuryMovement.
//
// Treasury tables (FinanceBankAccount, FinanceTreasuryLedger,
// FinanceTreasuryAllocation, FinanceTreasurySettlement) are NOT in the
// source's REVERTIBLE_TABLES whitelist (see lib/finance/changeJournal.ts)
// and treasury.py's own mutations never call its log_reversible()
// equivalent for these tables — only a flat, non-reversible audit() call
// (source lines 75-76, 106, 142-143, 173). This port intentionally does
// not reproduce that flat audit-table write: there is no Finance-specific
// "write a flat audit row" helper established elsewhere in this module
// (ledgerData.ts/changeJournal.ts only cover the reversible journal), and
// the per-function instructions for this port say to implement the
// mutation plainly when the source doesn't call log_reversible. Flagging
// this explicitly in case a later stage wants treasury mutations written
// to the app-wide AuditLog model too.

export const FUNDS = ["S&M", "Development", "Unallocated"] as const;
export type TreasuryFund = (typeof FUNDS)[number];

export const KINDS = [
  "Opening balance allocation",
  "ERP receipt",
  "ERP payment",
  "Manual receipt",
  "Manual payment",
  "Fund adjustment",
  "Fund reclassification",
] as const;
export type TreasuryMovementKind = (typeof KINDS)[number];

export const STATUSES = ["Pending", "Scheduled", "In transit", "Paid", "Failed", "Cancelled"] as const;
export type TreasurySettlementStatus = (typeof STATUSES)[number];

// --- internal validation helpers (mirror the source's short/date/cur/amt) --

class TreasuryValidationError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function fail(status: number, message: string): TreasuryValidationError {
  return new TreasuryValidationError(status, message);
}

/** Direct port of the source's short(). Note: uses `||`, not `??`, to match Python's `x or ''` falsy semantics exactly. */
function short(x: unknown, n = 120): string {
  return String(x || "").trim().slice(0, n);
}

/** Direct port of the source's date() — validates/normalizes a YYYY-MM-DD string, rejecting invalid calendar dates (e.g. 2024-02-30). */
function parseDateOnly(x: unknown): Date {
  const s = String(x || "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d) return dt;
  }
  throw fail(400, "Provide a valid date in YYYY-MM-DD format");
}

/** Direct port of the source's cur() — a strict 3-letter ISO currency code. */
function cur(x: unknown): string {
  const s = short(x, 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(s)) throw fail(400, "Currency must be a three-letter ISO code");
  return s;
}

/**
 * Direct port of the source's amt(). The source uses Python's Decimal for
 * exact parsing before rounding to 2dp; this uses Number instead (no
 * Decimal-equivalent in the standard lib), which can differ at the extreme
 * edge of float precision, but the final round-to-2dp step makes the
 * practical result identical for all realistic monetary inputs.
 */
function amt(x: unknown, positive = false): number {
  if (x === null || x === undefined || x === "") throw fail(400, "Enter a valid amount");
  const n = typeof x === "number" ? x : Number(x);
  if (Number.isNaN(n)) throw fail(400, "Enter a valid amount");
  if (!Number.isFinite(n) || Math.abs(n) > 100000000000000 || (positive && n < 0)) {
    throw fail(400, "Amount outside permitted range");
  }
  return round2(n);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// --- bank accounts -----------------------------------------------------

export type BankAccountInput = {
  id?: string;
  label: string;
  bank: string;
  legalEntity: string;
  currency: string;
  maskedAccount?: string;
  country?: string;
  erpSourceId?: string;
  erpAccountNumber?: string;
  erpAccountId?: string;
  paymentSourceId?: string;
  usdPerUnit?: number | string | null;
  fxAsOf?: string | null;
  active?: boolean;
};

export type RegisterBankAccountResult =
  | { ok: true; id: string }
  | { ok: false; status: number; error: string };

/**
 * Registers or updates a treasury bank account — direct port of the
 * source's account() (treasury.py lines 77-107). Preserves: the
 * currency/legal-entity immutability rule once ledger movements exist
 * (line 81), the ERP source+account-number pairing rule (lines 84-88),
 * the payment-source "Bank account" kind + one-bank-per-source rule
 * (lines 89-91), and the USD conversion rate/timestamp rules (lines
 * 92-100, including auto-stamping rate=1.0 for a USD-denominated account).
 */
export async function registerBankAccount(body: BankAccountInput): Promise<RegisterBankAccountResult> {
  try {
    const providedId = body.id ? short(body.id, 90) : "";
    const old = providedId ? await prisma.financeBankAccount.findUnique({ where: { id: providedId } }) : null;
    if (providedId && !old) throw fail(404, "Bank account not found");

    const currency = cur(body.currency);
    const legalEntity = short(body.legalEntity, 150);

    if (old && (old.currency !== currency || old.legalEntity !== legalEntity)) {
      const hasLedger = await prisma.financeTreasuryLedger.findFirst({ where: { bankAccountId: old.id } });
      if (hasLedger) {
        throw fail(
          409,
          "Cannot change bank currency or legal entity after allocations exist. Create a separate bank account and reconcile with Finance."
        );
      }
    }

    const label = short(body.label, 160);
    const bank = short(body.bank, 120);
    if (!label || !bank || !legalEntity) throw fail(400, "Account name, bank and legal entity are required");

    const erpSourceId = short(body.erpSourceId, 90);
    const erpAccountNumber = short(body.erpAccountNumber, 150);
    if (Boolean(erpSourceId) !== Boolean(erpAccountNumber)) {
      throw fail(400, "Select both the ERP source and ERP bank account number, or leave both blank.");
    }
    if (erpSourceId) {
      const src = await prisma.financeErpSource.findFirst({ where: { id: erpSourceId, active: true } });
      if (!src) throw fail(400, "Select a registered, active ERP source.");
    }
    const externalAccountId = erpSourceId
      ? `${erpSourceId}::${erpAccountNumber}`
      : short(body.erpAccountId, 150) || null;

    const paymentSourceId = short(body.paymentSourceId, 90) || null;
    if (paymentSourceId) {
      const src = await prisma.financePaymentSource.findFirst({
        where: { id: paymentSourceId, kind: "Bank account" },
      });
      if (!src) throw fail(400, "Select an existing company bank account for payment tracing");
      const clash = await prisma.financeBankAccount.findFirst({
        where: { paymentSourceId, ...(providedId ? { id: { not: providedId } } : {}) },
      });
      if (clash) throw fail(400, "This payment source is already connected to a different treasury bank");
    }

    let usdPerUnit: number | null = null;
    const rateRaw = body.usdPerUnit;
    if (rateRaw !== "" && rateRaw !== null && rateRaw !== undefined) {
      const rate = typeof rateRaw === "number" ? rateRaw : Number(rateRaw);
      if (Number.isNaN(rate)) throw fail(400, "Provide a valid USD conversion rate");
      if (!(rate > 0 && rate <= 100000)) throw fail(400, "USD conversion rate is out of range");
      usdPerUnit = rate;
    }
    let fxAsOf: Date | null = null;
    if (usdPerUnit !== null) {
      if (!body.fxAsOf) throw fail(400, "Provide the rate timestamp for the USD conversion");
      fxAsOf = new Date(body.fxAsOf);
      if (Number.isNaN(fxAsOf.getTime())) throw fail(400, "Provide the rate timestamp for the USD conversion");
    }
    if (currency === "USD") {
      usdPerUnit = 1.0;
      fxAsOf = new Date();
    }

    const data = {
      label,
      bank,
      maskedAccount: short(body.maskedAccount, 50) || null,
      country: short(body.country, 80) || null,
      legalEntity,
      currency,
      erpAccountId: externalAccountId,
      paymentSourceId,
      usdPerUnit,
      fxAsOf,
      active: body.active ?? true,
      erpSourceId: erpSourceId || null,
      erpAccountNumber: erpAccountNumber || null,
    };

    try {
      const saved = old
        ? await prisma.financeBankAccount.update({ where: { id: old.id }, data })
        : await prisma.financeBankAccount.create({ data: providedId ? { id: providedId, ...data } : data });
      return { ok: true, id: saved.id };
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "P2002") {
        throw fail(409, "This ERP source and bank account number are already mapped to another bank");
      }
      throw e;
    }
  } catch (e) {
    if (e instanceof TreasuryValidationError) return { ok: false, status: e.status, error: e.message };
    throw e;
  }
}

// --- ledger movements ----------------------------------------------------

export type TreasuryAllocationInput = { fund: string; amount: number | string };

export type PostMovementInput = {
  bankAccountId: string;
  transactionType: string;
  amount: number | string;
  date: string;
  allocations: TreasuryAllocationInput[];
  sourceUid: string;
  reference?: string;
  approvedBy: string;
  note?: string;
  description?: string;
};

export type PostMovementResult =
  | { ok: true; id: string; sourceUid: string }
  | { ok: false; status: number; error: string };

/**
 * Posts a bank movement with its mandatory fund-split allocation — direct
 * port of the source's movement() (treasury.py lines 108-143). Preserves:
 * sign rules per movement kind (receipts positive, payments negative,
 * reclassifications net zero — lines 115-119), 1-3 unique fund
 * allocations whose signs match the movement and which must sum to
 * *exactly* the movement amount within the source's 0.011 tolerance (not
 * 0.01 — kept exact, line 129), the reclassification debit+credit
 * requirement (line 130), and the source-UID duplicate-posting guard
 * (lines 131-134).
 */
export async function postTreasuryMovement(body: PostMovementInput): Promise<PostMovementResult> {
  try {
    const bankAccountId = short(body.bankAccountId, 90);
    const acc = await prisma.financeBankAccount.findUnique({ where: { id: bankAccountId } });
    if (!acc) throw fail(404, "Select a registered bank account");

    const kind = short(body.transactionType, 60);
    if (!(KINDS as readonly string[]).includes(kind)) throw fail(400, "Choose a valid movement type");

    const value = amt(body.amount);
    const txnDate = parseDateOnly(body.date);

    if (value === 0 && kind !== "Fund reclassification") throw fail(400, "Movement amount cannot be zero");
    if (kind === "Fund reclassification" && value !== 0) {
      throw fail(400, "Fund reclassification amount must be zero, with equal debit and credit allocations");
    }
    if ((kind === "ERP receipt" || kind === "Manual receipt") && value < 0) {
      throw fail(400, "Receipt amount must be positive");
    }
    if ((kind === "ERP payment" || kind === "Manual payment") && value > 0) {
      throw fail(400, "Payment amount must be negative");
    }
    if ((kind === "Opening balance allocation" || kind === "Fund reclassification") && !short(body.note)) {
      throw fail(400, "Opening allocations require a note explaining the supporting balance");
    }

    const allocationsInput = body.allocations;
    if (!Array.isArray(allocationsInput) || allocationsInput.length < 1 || allocationsInput.length > 3) {
      throw fail(400, "Provide one to three fund allocations");
    }
    const totals: Record<string, number> = {};
    for (const x of allocationsInput) {
      const f = short(x.fund, 40);
      if (!(FUNDS as readonly string[]).includes(f) || f in totals) {
        throw fail(400, "Each allocation must have a unique valid fund");
      }
      const n = amt(x.amount);
      if (kind !== "Fund reclassification" && n !== 0 && n > 0 !== value > 0) {
        throw fail(400, "All split amounts must have the same sign as the movement");
      }
      totals[f] = n;
    }
    const sumTotals = round2(Object.values(totals).reduce((s, v) => s + v, 0));
    if (Math.abs(sumTotals - value) > 0.011) {
      throw fail(400, "Fund allocations must exactly equal the original bank movement");
    }
    if (kind === "Fund reclassification" && Object.values(totals).filter((v) => v !== 0).length < 2) {
      throw fail(400, "A fund reclassification needs both a debit and a credit allocation");
    }

    const uid = short(body.sourceUid, 200);
    if (!uid) throw fail(400, "Provide a unique bank or ERP transaction UID to prevent duplicate posting");
    const existing = await prisma.financeTreasuryLedger.findUnique({ where: { sourceUid: uid } });
    if (existing) {
      throw fail(409, "A bank movement with this source UID is already recorded. No duplicate was added.");
    }

    const approvedBy = short(body.approvedBy, 150);
    if (!approvedBy) throw fail(400, "Name of approving Finance reviewer is required");

    const reference = short(body.reference, 200);
    const note = short(body.note, 2000);
    const description = short(body.description, 300);

    const ledger = await prisma.financeTreasuryLedger.create({
      data: {
        sourceUid: uid,
        bankAccountId,
        txnDate,
        transactionType: kind,
        amount: value,
        currency: acc.currency ?? "",
        reference: reference || null,
        description: description || null,
        note: note || null,
        approvedBy,
      },
    });

    for (const [fund, n] of Object.entries(totals)) {
      if (n) {
        await prisma.financeTreasuryAllocation.create({
          data: { ledgerId: ledger.id, fund, amount: n },
        });
      }
    }

    return { ok: true, id: ledger.id, sourceUid: uid };
  } catch (e) {
    if (e instanceof TreasuryValidationError) return { ok: false, status: e.status, error: e.message };
    throw e;
  }
}

// --- processor settlements -----------------------------------------------

export type RecordSettlementInput = {
  provider: string;
  payoutId: string;
  bankAccountId: string;
  currency: string;
  fund: string;
  status: string;
  gross: number | string;
  fees?: number | string;
  refunds?: number | string;
  disputes?: number | string;
  reserve?: number | string;
  otherAdjustments?: number | string;
  expectedDate: string;
  actualDate?: string | null;
  reconciledLedgerId?: string | null;
  merchantAccount?: string;
  legalEntity?: string;
  note?: string;
  source?: string;
};

export type RecordSettlementResult =
  | { ok: true; id: string; net: number }
  | { ok: false; status: number; error: string };

/**
 * Records or updates a Stripe/Trust Payments payout settlement and
 * (optionally) reconciles it against a bank ledger movement — direct port
 * of the source's settlement() (treasury.py lines 144-174). Preserves:
 * the gross/fees/refunds/disputes/reserve(+otherAdjustments) -> net
 * calculation (line 159), the currency-must-match-bank rule (never mixes
 * currencies without an explicit reconciled FX settlement in the
 * destination currency — line 153), the Paid-requires-actual-date rule
 * (line 161), the reconciled-ledger-amount-must-equal-net rule (line
 * 166), and the "already reconciled" immutability guard (line 168).
 *
 * Deviation: the exact Prisma schema given for this port marks
 * FinanceTreasurySettlement.reconciledLedgerId as a standalone @unique
 * column (one settlement per ledger row), which the source's SQLite
 * schema does not enforce at the DB level for this column. Linking two
 * different settlements to the same ledger row therefore throws here
 * (converted to a 409) where the source would have allowed it — flagging
 * this in case that stricter behaviour needs sign-off.
 */
export async function recordSettlement(body: RecordSettlementInput): Promise<RecordSettlementResult> {
  try {
    const provider = short(body.provider, 30);
    if (provider !== "Stripe" && provider !== "Trust Payments") {
      throw fail(400, "Select Stripe or Trust Payments");
    }

    const payoutId = short(body.payoutId, 200);
    if (!payoutId) throw fail(400, "Unique provider payout ID required");

    const bankAccountId = short(body.bankAccountId, 100);
    const acc = await prisma.financeBankAccount.findUnique({ where: { id: bankAccountId } });
    if (!acc) throw fail(404, "Select a registered destination bank");

    const currency = cur(body.currency);
    if (currency !== acc.currency) {
      throw fail(
        400,
        "Settlement currency differs from bank currency, provide reconciled FX settlement in the destination currency"
      );
    }

    const fund = short(body.fund, 30);
    if (!(FUNDS as readonly string[]).includes(fund)) throw fail(400, "Choose the fund for this settlement");

    const status = short(body.status, 30);
    if (!(STATUSES as readonly string[]).includes(status)) throw fail(400, "Invalid settlement status");

    const gross = amt(body.gross, true);
    const fees = amt(body.fees ?? 0, true);
    const refunds = amt(body.refunds ?? 0, true);
    const disputes = amt(body.disputes ?? 0, true);
    const reserve = amt(body.reserve ?? 0, true);
    const other = amt(body.otherAdjustments ?? 0);
    const net = round2(gross - fees - refunds - disputes - reserve + other);

    const expectedDate = parseDateOnly(body.expectedDate);
    const actualDate = body.actualDate ? parseDateOnly(body.actualDate) : null;
    if (status === "Paid" && !actualDate) throw fail(400, "Paid settlements require actual arrival date");

    const linked = short(body.reconciledLedgerId, 100) || null;
    if (linked) {
      const row = await prisma.financeTreasuryLedger.findFirst({ where: { id: linked, bankAccountId } });
      if (!row) throw fail(404, "Bank reconciliation ledger movement is not found for destination account");
      if (round2(row.amount) !== net) {
        throw fail(400, "Reconciled bank receipt amount must equal processor net payout");
      }
    }

    const old = await prisma.financeTreasurySettlement.findFirst({ where: { provider, payoutId } });
    if (old && old.reconciledLedgerId && old.reconciledLedgerId !== linked) {
      throw fail(409, "Already reconciled payout cannot be unlinked or moved without an audited adjustment");
    }

    const source = short(body.source, 80) || "Manual / staged";
    const legalEntity = short(body.legalEntity, 150) || acc.legalEntity || null;
    const merchantAccount = short(body.merchantAccount, 120) || null;
    const note = short(body.note, 1200) || null;

    const data = {
      provider,
      payoutId,
      merchantAccount,
      legalEntity,
      bankAccountId,
      currency,
      gross,
      fees,
      refunds,
      disputes,
      reserve,
      otherAdjustments: other,
      net,
      expectedDate,
      actualDate,
      status,
      fund,
      reconciledLedgerId: linked,
      note,
      source,
    };

    try {
      const saved = old
        ? await prisma.financeTreasurySettlement.update({ where: { id: old.id }, data })
        : await prisma.financeTreasurySettlement.create({ data });
      return { ok: true, id: saved.id, net };
    } catch (e: unknown) {
      if ((e as { code?: string })?.code === "P2002") {
        throw fail(409, "This bank movement is already reconciled against a different settlement payout.");
      }
      throw e;
    }
  } catch (e) {
    if (e instanceof TreasuryValidationError) return { ok: false, status: e.status, error: e.message };
    throw e;
  }
}

// --- state / reconciliation -----------------------------------------------

export type CreditForecastEvent = {
  bankSourceId: string;
  currency: string;
  date: string; // YYYY-MM-DD
  amount: number;
  kind?: string;
  detailId?: string;
  label?: string;
};

export type CreditForecast = { events: CreditForecastEvent[] };

/**
 * Computes per-bank balance/allocation/reconciliation state and per-fund
 * USD rollups — direct port of the source's state() (treasury.py lines
 * 175-221). `creditForecast` is an externally-computed set of future
 * credit events (invoices/recurring charges due on a bank) — it is NOT
 * computed by this file (the source's own caller builds it from its
 * credit-forecast sub-domain before calling state()); omit it to get
 * state with zero commitments, same as the source's `credit_forecast=None`
 * default (line 175, `credit_forecast or {'events': []}` on line 183).
 *
 * Preserves: ERP snapshot-vs-allocation reconciliation gap per bank
 * (lines 209-211, "<1 cent" verifiedCash tolerance on line 214), the rule
 * that untagged physical cash is never treated as free/allocated cash
 * (comment at line 212-213), the currency-mismatch guard for forecast
 * events against their bank's native currency (never silently summed —
 * lines 192, 215), and the "only show USD totals when every bank in the
 * fund has a verified FX quote" rule for per-fund USD rollups (lines
 * 219-220).
 */
export async function getTreasuryState(creditForecast?: CreditForecast) {
  const [accounts, ledgerRows, settlements, bankBalances] = await Promise.all([
    prisma.financeBankAccount.findMany({
      orderBy: [{ legalEntity: "asc" }, { bank: "asc" }, { label: "asc" }],
    }),
    prisma.financeTreasuryLedger.findMany({
      orderBy: [{ txnDate: "desc" }, { createdAt: "desc" }],
      include: { allocations: true },
    }),
    prisma.financeTreasurySettlement.findMany({ orderBy: { expectedDate: "desc" } }),
    prisma.financeErpBankBalance.findMany(),
  ]);

  // One row per fund allocation, matching the source's SQL join of
  // treasury_ledger to treasury_allocations (a 2-way split surfaces as
  // two rows here, each carrying its own fund/allocatedAmount).
  const ledger = ledgerRows.flatMap((l) => {
    const { allocations, ...rest } = l;
    return allocations.map((a) => ({ ...rest, fund: a.fund, allocatedAmount: a.amount }));
  });

  // Latest snapshot per external account id. The source does this with a
  // GROUP BY/MAX self-join in SQL; computed here in JS with equivalent
  // "latest asOf wins" semantics.
  const balances = new Map<string, (typeof bankBalances)[number]>();
  for (const b of bankBalances) {
    const existing = balances.get(b.externalAccountId);
    if (!existing || b.asOf > existing.asOf) balances.set(b.externalAccountId, b);
  }

  const allocations: Record<string, Record<string, number>> = {};
  for (const a of accounts) allocations[a.id] = { "S&M": 0, Development: 0, Unallocated: 0 };
  for (const row of ledger) {
    const bucket = allocations[row.bankAccountId];
    if (bucket) bucket[row.fund] = round2((bucket[row.fund] ?? 0) + row.allocatedAmount);
  }

  const forecast = creditForecast ?? { events: [] };
  const paymentMap = new Map<string, string>();
  for (const a of accounts) if (a.paymentSourceId) paymentMap.set(a.paymentSourceId, a.id);

  // Reserved outgoings remain distinct from bank cash; future commitments
  // are never posted to the ledger itself.
  const commitments: Record<string, number> = {};
  const committedByFund: Record<string, Record<string, number>> = {};
  for (const a of accounts) {
    commitments[a.id] = 0;
    committedByFund[a.id] = { "S&M": 0, Development: 0, Unallocated: 0 };
  }
  const missingCurrency: Array<{ bankId: string; payment?: string; currency: string }> = [];

  for (const e of forecast.events) {
    const aid = paymentMap.get(e.bankSourceId);
    const acct = aid ? accounts.find((a) => a.id === aid) : undefined;
    if (!acct || !aid) continue;
    if (e.currency !== acct.currency) {
      missingCurrency.push({ bankId: aid, payment: e.label, currency: e.currency });
      continue;
    }
    const snap = acct.erpAccountId ? balances.get(acct.erpAccountId) : undefined;
    if (snap && e.date <= snap.asOf.toISOString().slice(0, 10)) continue;
    commitments[aid] = round2(commitments[aid] + e.amount);
    let commitmentFund: TreasuryFund = "Unallocated";
    if (e.kind === "Invoice" && e.detailId) {
      const invoice = await prisma.financeCreditInvoice.findUnique({ where: { id: e.detailId } });
      if (invoice) {
        if (invoice.department === "Sales" || invoice.department === "Marketing") commitmentFund = "S&M";
        else if (invoice.department === "Development") commitmentFund = "Development";
      }
    }
    committedByFund[aid][commitmentFund] = round2(committedByFund[aid][commitmentFund] + e.amount);
  }

  const pending = settlements.filter(
    (p) => !p.reconciledLedgerId && !["Paid", "Failed", "Cancelled"].includes(p.status)
  );

  const out = accounts.map((a) => {
    const snap = a.erpAccountId ? balances.get(a.erpAccountId) : undefined;
    const physical = snap ? snap.ledgerBalance : null;
    const alloc = allocations[a.id];
    const allocatedTotal = round2(Object.values(alloc).reduce((s, v) => s + v, 0));
    const gap = physical == null ? null : round2(physical - allocatedTotal);
    const freeKnown = round2(alloc["S&M"] + alloc["Development"] - commitments[a.id]);
    return {
      ...a,
      balanceSource: snap ? "ERP ledger snapshot" : "Awaiting ERP",
      physicalBalance: physical,
      availableBankBalance: snap ? snap.availableBalance : null,
      asOf: snap ? snap.asOf : null,
      allocations: alloc,
      allocatedTotal,
      reconciliationDifference: gap,
      commitments: commitments[a.id],
      committedByFund: committedByFund[a.id],
      fundedLessCommitments: freeKnown,
      pendingPayouts: round2(
        pending.filter((p) => p.bankAccountId === a.id).reduce((s, p) => s + (p.net ?? 0), 0)
      ),
      verifiedCash: Boolean(snap) && gap !== null && Math.abs(gap) < 0.01,
      hasFX: a.currency === "USD" || Boolean(a.usdPerUnit),
    };
  });

  // USD display includes only verified native FX quotes; never mix
  // currencies silently.
  const funds = FUNDS.map((fund) => {
    const byBank = out
      .filter((a) => a.allocations[fund])
      .map((a) => ({
        bankId: a.id,
        label: a.label,
        bank: a.bank,
        maskedAccount: a.maskedAccount,
        legalEntity: a.legalEntity,
        country: a.country,
        currency: a.currency,
        amount: a.allocations[fund],
        usdEquivalent: a.usdPerUnit ? round2(a.allocations[fund] * a.usdPerUnit) : null,
        fxAsOf: a.fxAsOf,
        bankLastReconciled: a.asOf,
        bankReconciliationGap: a.reconciliationDifference,
      }));
    const complete = byBank.every((x) => x.usdEquivalent !== null);
    return {
      fund,
      banks: byBank,
      usdTotal: complete ? round2(byBank.reduce((s, x) => s + (x.usdEquivalent ?? 0), 0)) : null,
      fxComplete: complete,
      bankCount: byBank.length,
      pendingFX: byBank.filter((x) => x.usdEquivalent === null).length,
    };
  });

  return {
    banks: out,
    funds,
    movements: ledger.slice(0, 500),
    settlements: settlements.slice(0, 300),
    pendingSettlements: pending,
    unreconciledSettlements: settlements.filter((p) => p.status === "Paid" && !p.reconciledLedgerId),
    currencyWarnings: missingCurrency,
    asOf: new Date().toISOString(),
    // Hardcoded in the source too (treasury.py line 221) — no live
    // processor/ERP feed is wired up yet. Preserved as a literal.
    integrationConnected: false,
  };
}
