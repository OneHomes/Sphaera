import { prisma } from "../prisma";

// Credit-cycle (cash-forecasting / accounts-payable) business logic, ported
// from the source Python app's credit_cycles.py. "Credit cycle" here means
// upcoming cash OUTFLOWS the business owes (AP invoices, recurring bills,
// company-card settlements) — NOT customer credit. It is deliberately
// separate from the immutable transaction ledger (lib/finance/ledgerData.ts):
// everything here is a forward-looking, advisory projection, never an
// accounting posting.
//
// Two invariants the source enforces deliberately (not incidental checks)
// and that this port preserves:
//
//  1. NO NETTING OF FUTURE SALES/COLLECTIONS. projection() below counts
//     known outflows only. It never queries any sales/collections/revenue
//     table, by design — see the `limitations` string returned by
//     projection(), which mirrors the source's own disclaimer text
//     (credit_cycles.py line 336: "Forward cash projection counts known
//     outflows only, not future sales receipts.").
//
//  2. NO MIXING CURRENCIES WITHOUT A TIMESTAMPED FX RATE. The source
//     enforces this with two deliberate ValueErrors: save_charge() (line
//     157, "Charge currency does not match card settlement currency...")
//     and save_bank_link() (line 173, "Opening balance must be in the bank
//     account currency"). IMPORTANT — see the flag in the final report:
//     the exact Prisma schema handed to this port does not carry a
//     reference currency on FinanceCreditCardRule/FinanceCreditCardCharge
//     or a manual-balance currency on FinanceCreditBankLink, so those two
//     specific mismatch guards cannot be reconstructed byte-for-byte here.
//     Currency *format* validation (3-letter ISO code) is still enforced
//     everywhere amounts are recorded, and amounts of different currencies
//     are still never summed together anywhere in projection().

// ---------------------------------------------------------------------------
// Shared validation helpers (ports of iso/money/currency/limit_text in the
// source).
// ---------------------------------------------------------------------------

function limitText(x: unknown, n: number): string {
  return String(x ?? "").trim().slice(0, n);
}

type MoneyResult = { ok: true; value: number } | { ok: false; error: string };

/** Direct port of money(): must be finite, non-negative, and within range. */
function parseMoney(x: unknown): MoneyResult {
  const v = typeof x === "number" ? x : parseFloat(String(x));
  if (!Number.isFinite(v) || v < 0 || v > 100_000_000_000_000) {
    return { ok: false, error: "Enter a valid amount" };
  }
  return { ok: true, value: v };
}

/** Like parseMoney but allows a negative value — used for opening balances
 * (overdrafts), matching save_bank_link()'s wider range (line 171). */
function parseSignedAmount(x: unknown): MoneyResult {
  const v = typeof x === "number" ? x : parseFloat(String(x));
  if (!Number.isFinite(v) || v < -100_000_000_000_000 || v > 100_000_000_000_000) {
    return { ok: false, error: "Invalid opening balance" };
  }
  return { ok: true, value: v };
}

type CurrencyResult = { ok: true; value: string } | { ok: false; error: string };

/** Direct port of currency(): must be a 3-letter ISO code. */
function parseCurrency(x: unknown): CurrencyResult {
  const s = String(x ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(s)) {
    return { ok: false, error: "Currency must be a three-letter code, e.g. GBP, USD or PKR" };
  }
  return { ok: true, value: s };
}

/** Normalizes a Date or "YYYY-MM-DD" string to a UTC-midnight Date (a pure
 * calendar date, matching the source's use of dt.date / ISO date strings
 * with no time component). Returns null if invalid. */
function toDateOnlyUTC(x: Date | string): Date | null {
  if (x instanceof Date) {
    if (Number.isNaN(x.getTime())) return null;
    return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
  }
  const s = String(x).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return d;
}

/** Renders a UTC-midnight Date as "YYYY-MM-DD", for comparisons/output that
 * mirror the source's ISO-string date handling. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDaysUTC(d: Date, days: number): Date {
  const r = new Date(d.getTime());
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

function utcDate(year: number, month1: number, day: number): Date {
  // month1 is 1-indexed, matching the source's dt.date(y, m, ...).
  return new Date(Date.UTC(year, month1 - 1, day));
}

function daysInMonth(year: number, month1: number): number {
  // month1 is 1-indexed; day 0 of the following (0-indexed) month is the
  // last day of month1 — equivalent to calendar.monthrange(y, m)[1].
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** Python's date.weekday(): Monday=0 ... Sunday=6. JS getUTCDay() is
 * Sunday=0 ... Saturday=6, so this converts to the source's convention.
 * The `weekday` field on FinanceCreditRecurring (and the `weekday` param
 * throughout this file) uses the Python convention (default 3 = Thursday,
 * matching the source's upsert_recurring default). */
function pyWeekday(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}
function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

// ---------------------------------------------------------------------------
// Recurrence expansion — direct port of monthly_date() and schedule().
// ---------------------------------------------------------------------------

export type RecurrenceRule =
  | "month_end"
  | "last_business_day"
  | "month_start"
  | "day_of_month"
  | "nth_weekday"
  | "last_weekday"
  | "weekly";

export const RECURRENCE_RULES: RecurrenceRule[] = [
  "month_end",
  "last_business_day",
  "month_start",
  "day_of_month",
  "nth_weekday",
  "last_weekday",
  "weekly",
];

/**
 * Direct port of the source's monthly_date(). Computes the concrete date
 * for one calendar month under a given recurrence kind. `weekday` uses the
 * Python convention (Monday=0 ... Sunday=6); `ordinal` is 1-based (1st,
 * 2nd, ... occurrence of that weekday in the month).
 */
export function monthlyDate(
  year: number,
  month1: number,
  kind: RecurrenceRule,
  day = 1,
  weekday = 3,
  ordinal = 1
): Date {
  const last = daysInMonth(year, month1);
  switch (kind) {
    case "month_end":
      return utcDate(year, month1, last);
    case "last_business_day": {
      let d = utcDate(year, month1, last);
      while (pyWeekday(d) >= 5) d = addDaysUTC(d, -1);
      return d;
    }
    case "month_start":
      return utcDate(year, month1, 1);
    case "day_of_month":
      return utcDate(year, month1, Math.min(day, last));
    case "nth_weekday": {
      const first = utcDate(year, month1, 1);
      const offset = (((weekday - pyWeekday(first)) % 7) + 7) % 7;
      let d = addDaysUTC(first, offset + 7 * (ordinal - 1));
      if (d.getUTCMonth() + 1 !== month1) d = addDaysUTC(d, -7);
      return d;
    }
    case "last_weekday": {
      const end = utcDate(year, month1, last);
      const back = (((pyWeekday(end) - weekday) % 7) + 7) % 7;
      return addDaysUTC(end, -back);
    }
    default:
      throw new Error("Invalid recurrence");
  }
}

export type RecurringRuleLike = {
  recurrenceRule: string;
  active: boolean;
  startDate: Date | null;
  endDate: Date | null;
  dayOfMonth?: number | null;
  weekday?: number | null;
  ordinal?: number | null;
};

/**
 * Direct port of the source's schedule(). Computes every concrete due date
 * a recurring bill fires on within [rangeStart, rangeEnd] (inclusive).
 * Returns [] for an inactive rule, a rule with no start date, or a rule
 * whose active window doesn't overlap the requested range.
 */
export function expandRecurrence(rule: RecurringRuleLike, rangeStart: Date, rangeEnd: Date): Date[] {
  if (!rule.active || !rule.startDate) return [];
  const begin = maxDate(rangeStart, toDateOnlyUTC(rule.startDate) ?? rule.startDate);
  const stop = rule.endDate ? minDate(rangeEnd, toDateOnlyUTC(rule.endDate) ?? rule.endDate) : rangeEnd;
  if (begin.getTime() > stop.getTime()) return [];

  const dayOfMonth = rule.dayOfMonth ?? 1;
  const weekday = rule.weekday ?? 3;
  const ordinal = rule.ordinal ?? 1;

  if (rule.recurrenceRule === "weekly") {
    const delta = (((weekday - pyWeekday(begin)) % 7) + 7) % 7;
    const results: Date[] = [];
    let d = addDaysUTC(begin, delta);
    while (d.getTime() <= stop.getTime()) {
      results.push(d);
      d = addDaysUTC(d, 7);
    }
    return results;
  }

  const results: Date[] = [];
  let y = begin.getUTCFullYear();
  let m = begin.getUTCMonth() + 1;
  const stopY = stop.getUTCFullYear();
  const stopM = stop.getUTCMonth() + 1;
  while (y < stopY || (y === stopY && m <= stopM)) {
    const d = monthlyDate(y, m, rule.recurrenceRule as RecurrenceRule, dayOfMonth, weekday, ordinal);
    if (d.getTime() >= begin.getTime() && d.getTime() <= stop.getTime()) results.push(d);
    if (m === 12) {
      y += 1;
      m = 1;
    } else {
      m += 1;
    }
  }
  return results;
}

/** Direct port of close_dates(): the statement-closing date for every
 * calendar month in [rangeStart, rangeEnd]. */
export function generateStatementCloseDates(statementDay: number, rangeStart: Date, rangeEnd: Date): Date[] {
  const res: Date[] = [];
  let y = rangeStart.getUTCFullYear();
  let m = rangeStart.getUTCMonth() + 1;
  const stopY = rangeEnd.getUTCFullYear();
  const stopM = rangeEnd.getUTCMonth() + 1;
  while (y < stopY || (y === stopY && m <= stopM)) {
    res.push(utcDate(y, m, Math.min(statementDay, daysInMonth(y, m))));
    if (m === 12) {
      y += 1;
      m = 1;
    } else {
      m += 1;
    }
  }
  return res;
}

// ---------------------------------------------------------------------------
// Invoices — direct port of upsert_invoice().
// ---------------------------------------------------------------------------

export type UpsertInvoiceParams = {
  id?: string;
  vendor?: string;
  invoiceNumber?: string | null;
  issueDate?: Date | string | null;
  dueDate?: Date | string;
  amount?: number;
  currency?: string;
  department?: string | null;
  costHead?: string | null;
  country?: string | null;
  paymentSourceId?: string | null;
  status?: string;
  paidDate?: Date | string | null;
  reference?: string | null;
  notes?: string | null;
};

export type InvoiceMutationResult = { ok: true; id: string } | { ok: false; status: number; error: string };

const INVOICE_STATUSES = ["Unpaid", "Scheduled", "Paid", "Cancelled"];

/**
 * Direct port of upsert_invoice(). Partial-update semantics when `id` is
 * supplied: any field left undefined keeps its currently stored value
 * (matching the source's `p.get(k, old[k])` merge).
 */
export async function upsertInvoice(params: UpsertInvoiceParams): Promise<InvoiceMutationResult> {
  const existing = params.id ? await prisma.financeCreditInvoice.findFirst({ where: { id: params.id } }) : null;
  if (params.id && !existing) return { ok: false, status: 404, error: "Invoice not found" };

  const vendor = limitText(params.vendor ?? existing?.vendor, 240);
  if (!vendor) return { ok: false, status: 400, error: "Supplier is required" };
  const invoiceNumber = limitText(params.invoiceNumber ?? existing?.invoiceNumber ?? "", 100) || null;

  const dueRaw = params.dueDate !== undefined ? params.dueDate : existing?.dueDate ?? undefined;
  if (dueRaw === undefined || dueRaw === null) {
    return { ok: false, status: 400, error: "Use a valid date in YYYY-MM-DD format" };
  }
  const dueDate = toDateOnlyUTC(dueRaw);
  if (!dueDate) return { ok: false, status: 400, error: "Use a valid date in YYYY-MM-DD format" };

  const issueRaw = params.issueDate !== undefined ? params.issueDate : existing?.issueDate ?? null;
  let issueDate: Date | null = null;
  if (issueRaw) {
    issueDate = toDateOnlyUTC(issueRaw);
    if (!issueDate) return { ok: false, status: 400, error: "Use a valid date in YYYY-MM-DD format" };
  }
  if (issueDate && dueDate.getTime() < issueDate.getTime()) {
    return { ok: false, status: 400, error: "Due date must be on or after invoice date" };
  }

  const amountResult = parseMoney(params.amount !== undefined ? params.amount : existing?.amount);
  if (!amountResult.ok) return { ok: false, status: 400, error: amountResult.error };
  const currencyResult = parseCurrency(params.currency ?? existing?.currency ?? "USD");
  if (!currencyResult.ok) return { ok: false, status: 400, error: currencyResult.error };

  const status = limitText(params.status ?? existing?.status ?? "Unpaid", 20);
  if (!INVOICE_STATUSES.includes(status)) return { ok: false, status: 400, error: "Invalid invoice status" };

  const department = limitText(params.department ?? existing?.department ?? "", 150) || null;
  const costHead = limitText(params.costHead ?? existing?.costHead ?? "", 150) || null;
  const country = limitText(params.country ?? existing?.country ?? "", 150) || null;
  const paymentSourceId = limitText(params.paymentSourceId ?? existing?.paymentSourceId ?? "", 150) || null;
  const reference = limitText(params.reference ?? existing?.reference ?? "", 150) || null;
  const notes = limitText(params.notes ?? existing?.notes ?? "", 2500) || null;

  const paidRaw = params.paidDate !== undefined ? params.paidDate : existing?.paidDate ?? null;
  let paidDate: Date | null = null;
  if (paidRaw) {
    paidDate = toDateOnlyUTC(paidRaw);
    if (!paidDate) return { ok: false, status: 400, error: "Use a valid date in YYYY-MM-DD format" };
  }
  if (status === "Paid" && !paidDate) {
    return { ok: false, status: 400, error: "Paid invoices require a paid date" };
  }

  const data = {
    vendor,
    invoiceNumber,
    issueDate,
    dueDate,
    amount: amountResult.value,
    currency: currencyResult.value,
    department,
    costHead,
    country,
    paymentSourceId,
    status,
    paidDate,
    reference,
    notes,
  };

  if (existing) {
    await prisma.financeCreditInvoice.update({ where: { id: existing.id }, data });
    return { ok: true, id: existing.id };
  }
  const created = await prisma.financeCreditInvoice.create({ data });
  return { ok: true, id: created.id };
}

export async function listInvoices(filter?: { status?: string }) {
  return prisma.financeCreditInvoice.findMany({
    where: filter?.status ? { status: filter.status } : undefined,
    orderBy: { dueDate: "asc" },
  });
}

export async function getInvoice(id: string) {
  return prisma.financeCreditInvoice.findFirst({ where: { id } });
}

export async function deleteInvoice(id: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const existing = await prisma.financeCreditInvoice.findFirst({ where: { id } });
  if (!existing) return { ok: false, status: 404, error: "Invoice not found" };
  await prisma.financeCreditInvoice.delete({ where: { id } });
  return { ok: true };
}

/**
 * Stores a reference to an already-uploaded document (lib/blobStorage.ts
 * handles the actual blob upload in a later, API-route stage — see the
 * module header of this file). Equivalent in spirit to the source's
 * attach_invoice(), minus the file-content validation (magic bytes,
 * extension, size) which belongs at the upload boundary, not here.
 */
export async function attachInvoiceDocument(
  invoiceId: string,
  documentId: string,
  documentHash?: string | null
): Promise<InvoiceMutationResult> {
  const existing = await prisma.financeCreditInvoice.findFirst({ where: { id: invoiceId } });
  if (!existing) return { ok: false, status: 404, error: "Create invoice first" };
  await prisma.financeCreditInvoice.update({
    where: { id: invoiceId },
    data: { documentId, documentHash: documentHash ?? null },
  });
  return { ok: true, id: invoiceId };
}

export async function clearInvoiceDocument(invoiceId: string): Promise<InvoiceMutationResult> {
  const existing = await prisma.financeCreditInvoice.findFirst({ where: { id: invoiceId } });
  if (!existing) return { ok: false, status: 404, error: "Invoice not found" };
  await prisma.financeCreditInvoice.update({ where: { id: invoiceId }, data: { documentId: null, documentHash: null } });
  return { ok: true, id: invoiceId };
}

// ---------------------------------------------------------------------------
// Recurring bills — direct port of upsert_recurring().
// ---------------------------------------------------------------------------

export type UpsertRecurringParams = {
  id?: string;
  title?: string;
  category?: string;
  beneficiary?: string | null;
  country?: string | null;
  currency?: string;
  amount?: number;
  paymentSourceId?: string | null;
  recurrenceRule?: string;
  dayOfMonth?: number | null;
  weekday?: number | null;
  ordinal?: number | null;
  startDate?: Date | string;
  endDate?: Date | string | null;
  active?: boolean;
  notes?: string | null;
};

const RECURRING_CATEGORIES = ["Salary", "Rent", "Tax", "Loan", "Utility", "Subscription", "Other"];

export async function upsertRecurring(params: UpsertRecurringParams): Promise<InvoiceMutationResult> {
  const existing = params.id ? await prisma.financeCreditRecurring.findFirst({ where: { id: params.id } }) : null;
  if (params.id && !existing) return { ok: false, status: 404, error: "Recurring rule not found" };

  const title = limitText(params.title ?? existing?.title, 200);
  if (!title) return { ok: false, status: 400, error: "Payment title is required" };
  const beneficiary = limitText(params.beneficiary ?? existing?.beneficiary ?? "", 200) || null;
  const notes = limitText(params.notes ?? existing?.notes ?? "", 1800) || null;

  const category = limitText(params.category ?? existing?.category, 30);
  if (!RECURRING_CATEGORIES.includes(category)) return { ok: false, status: 400, error: "Invalid bill type" };

  const currencyResult = parseCurrency(params.currency ?? existing?.currency ?? "USD");
  if (!currencyResult.ok) return { ok: false, status: 400, error: currencyResult.error };
  const amountResult = parseMoney(params.amount !== undefined ? params.amount : existing?.amount);
  if (!amountResult.ok) return { ok: false, status: 400, error: amountResult.error };

  const recurrenceRule = limitText(params.recurrenceRule ?? existing?.recurrenceRule, 40);
  if (!RECURRENCE_RULES.includes(recurrenceRule as RecurrenceRule)) {
    return { ok: false, status: 400, error: "Invalid pay-date rule" };
  }

  const dayOfMonth = params.dayOfMonth ?? existing?.dayOfMonth ?? 1;
  const weekday = params.weekday ?? existing?.weekday ?? 3;
  const ordinal = params.ordinal ?? existing?.ordinal ?? 1;
  if (!(dayOfMonth >= 1 && dayOfMonth <= 31) || !(weekday >= 0 && weekday <= 6) || !(ordinal >= 1 && ordinal <= 5)) {
    return { ok: false, status: 400, error: "Invalid recurrence schedule" };
  }

  const startRaw = params.startDate !== undefined ? params.startDate : existing?.startDate ?? undefined;
  if (startRaw === undefined || startRaw === null) {
    return { ok: false, status: 400, error: "Use a valid date in YYYY-MM-DD format" };
  }
  const startDate = toDateOnlyUTC(startRaw);
  if (!startDate) return { ok: false, status: 400, error: "Use a valid date in YYYY-MM-DD format" };

  const endRaw = params.endDate !== undefined ? params.endDate : existing?.endDate ?? null;
  let endDate: Date | null = null;
  if (endRaw) {
    endDate = toDateOnlyUTC(endRaw);
    if (!endDate) return { ok: false, status: 400, error: "Use a valid date in YYYY-MM-DD format" };
  }
  if (endDate && endDate.getTime() < startDate.getTime()) {
    return { ok: false, status: 400, error: "End date precedes start date" };
  }

  const active = params.active !== undefined ? params.active : existing?.active ?? true;
  const country = limitText(params.country ?? existing?.country ?? "", 70) || null;
  const paymentSourceId = limitText(params.paymentSourceId ?? existing?.paymentSourceId ?? "", 90) || null;

  const data = {
    title,
    category,
    beneficiary,
    country,
    currency: currencyResult.value,
    amount: amountResult.value,
    paymentSourceId,
    recurrenceRule,
    dayOfMonth,
    weekday,
    ordinal,
    startDate,
    endDate,
    active,
    notes,
  };

  if (existing) {
    await prisma.financeCreditRecurring.update({ where: { id: existing.id }, data });
    return { ok: true, id: existing.id };
  }
  const created = await prisma.financeCreditRecurring.create({ data });
  return { ok: true, id: created.id };
}

export async function listRecurring(filter?: { activeOnly?: boolean }) {
  return prisma.financeCreditRecurring.findMany({
    where: filter?.activeOnly ? { active: true } : undefined,
    orderBy: { title: "asc" },
  });
}

export async function getRecurring(id: string) {
  return prisma.financeCreditRecurring.findFirst({ where: { id } });
}

export async function deleteRecurring(id: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const existing = await prisma.financeCreditRecurring.findFirst({ where: { id } });
  if (!existing) return { ok: false, status: 404, error: "Recurring rule not found" };
  await prisma.financeCreditRecurring.delete({ where: { id } });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Company-card rules/statements/charges — ports of save_card_rule(),
// save_statement(), save_charge().
//
// FLAG — see final report: the source identifies a card rule by the
// company card's own payment-source id (`credit_card_rules.source_id`,
// UNIQUE — credit_cycles.py line 31), separate from the settlement bank
// account (`payment_account_id`). The Prisma schema handed to this port
// has only `paymentAccountId` on FinanceCreditCardRule — there is no field
// identifying which company-card payment source a rule belongs to. This
// port treats `paymentAccountId` as the settlement bank account (matching
// the source's own field of that name) and cannot resolve a card's own
// name/currency the way the source's `card_name`/`card_currency` joins do.
// ---------------------------------------------------------------------------

export type SaveCardRuleParams = {
  id?: string;
  paymentAccountId?: string | null;
  statementDay: number;
  dueOffsetDays: number;
  settlement?: string;
};

const SETTLEMENT_KINDS = ["Full statement", "Statement minimum"];

export async function saveCardRule(params: SaveCardRuleParams): Promise<InvoiceMutationResult> {
  const existing = params.id ? await prisma.financeCreditCardRule.findFirst({ where: { id: params.id } }) : null;
  if (params.id && !existing) return { ok: false, status: 404, error: "Card cycle not found" };

  const d = Math.trunc(params.statementDay);
  const offset = Math.trunc(params.dueOffsetDays);
  if (!(d >= 1 && d <= 31) || !(offset >= 1 && offset <= 65)) {
    return { ok: false, status: 400, error: "Enter closing day (1 to 31) and due days after closing (1 to 65)" };
  }

  const paymentAccountId = limitText(params.paymentAccountId ?? "", 100) || null;
  if (paymentAccountId) {
    const account = await prisma.financePaymentSource.findFirst({
      where: { id: paymentAccountId, kind: "Bank account" },
    });
    if (!account) return { ok: false, status: 400, error: "Select a bank account for card settlement" };
  }

  const settlement = limitText(params.settlement ?? "Full statement", 30);
  if (!SETTLEMENT_KINDS.includes(settlement)) return { ok: false, status: 400, error: "Invalid settlement preference" };

  const data = { paymentAccountId, statementDay: d, dueOffsetDays: offset, settlement };

  if (existing) {
    await prisma.financeCreditCardRule.update({ where: { id: existing.id }, data });
    return { ok: true, id: existing.id };
  }
  const created = await prisma.financeCreditCardRule.create({ data });
  return { ok: true, id: created.id };
}

export async function listCardRules() {
  return prisma.financeCreditCardRule.findMany({ include: { statements: true } });
}

export async function getCardRule(id: string) {
  return prisma.financeCreditCardRule.findFirst({ where: { id }, include: { statements: true } });
}

export async function deleteCardRule(id: string): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const existing = await prisma.financeCreditCardRule.findFirst({ where: { id } });
  if (!existing) return { ok: false, status: 404, error: "Card cycle not found" };
  await prisma.financeCreditCardRule.delete({ where: { id } });
  return { ok: true };
}

export type SaveCardStatementParams = {
  id?: string;
  cardRuleId: string;
  closingDate: Date | string;
  amount?: number;
  minimumDue?: number | null;
  amountPaid?: number;
  status?: string;
};

const STATEMENT_STATUSES = ["Open", "Paid", "Disputed"];

/**
 * Direct port of save_statement(). NOTE — the Prisma schema has no
 * per-statement due-date column (the source's credit_card_statements.
 * due_date, line 38); the due date is always derived as
 * `closingDate + rule.dueOffsetDays` wherever it's needed (see
 * `projection()` below), never stored.
 */
export async function saveCardStatement(params: SaveCardStatementParams): Promise<InvoiceMutationResult> {
  const rule = await prisma.financeCreditCardRule.findFirst({ where: { id: params.cardRuleId } });
  if (!rule) return { ok: false, status: 400, error: "Card cycle must be configured before its statement" };

  const closingDate = toDateOnlyUTC(params.closingDate);
  if (!closingDate) return { ok: false, status: 400, error: "Use a valid date in YYYY-MM-DD format" };

  const existing = params.id
    ? await prisma.financeCreditCardStatement.findFirst({ where: { id: params.id } })
    : await prisma.financeCreditCardStatement.findFirst({
        where: { cardRuleId: rule.id, closingDate },
      });

  const amountResult = parseMoney(params.amount !== undefined ? params.amount : existing?.amount);
  if (!amountResult.ok) return { ok: false, status: 400, error: amountResult.error };

  let minimumDue: number | null = null;
  const minRaw = params.minimumDue !== undefined ? params.minimumDue : existing?.minimumDue ?? null;
  if (minRaw !== null && minRaw !== undefined && String(minRaw).trim() !== "") {
    const minResult = parseMoney(minRaw);
    if (!minResult.ok) return { ok: false, status: 400, error: minResult.error };
    minimumDue = minResult.value;
  }
  if (minimumDue !== null && minimumDue > amountResult.value) {
    return { ok: false, status: 400, error: "Minimum due cannot exceed statement balance" };
  }

  const paidResult = parseMoney(params.amountPaid ?? existing?.amountPaid ?? 0);
  if (!paidResult.ok) return { ok: false, status: 400, error: paidResult.error };

  const status = limitText(params.status ?? existing?.status ?? "Open", 20);
  if (!STATEMENT_STATUSES.includes(status)) return { ok: false, status: 400, error: "Invalid statement status" };

  const data = {
    cardRuleId: rule.id,
    closingDate,
    amount: amountResult.value,
    minimumDue,
    amountPaid: paidResult.value,
    status,
  };

  if (existing) {
    await prisma.financeCreditCardStatement.update({ where: { id: existing.id }, data });
    return { ok: true, id: existing.id };
  }
  const created = await prisma.financeCreditCardStatement.create({ data });
  return { ok: true, id: created.id };
}

export async function listCardStatements(cardRuleId?: string) {
  return prisma.financeCreditCardStatement.findMany({
    where: cardRuleId ? { cardRuleId } : undefined,
    orderBy: { closingDate: "desc" },
  });
}

export async function getCardStatement(id: string) {
  return prisma.financeCreditCardStatement.findFirst({ where: { id }, include: { charges: true } });
}

export async function deleteCardStatement(
  id: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const existing = await prisma.financeCreditCardStatement.findFirst({ where: { id } });
  if (!existing) return { ok: false, status: 404, error: "Statement not found" };
  await prisma.financeCreditCardStatement.delete({ where: { id } });
  return { ok: true };
}

export type SaveCardChargeParams = {
  id?: string;
  statementId: string;
  merchant?: string;
  amount?: number;
  currency?: string;
  reference?: string | null;
};

/**
 * Direct port of save_charge() — minus the card-currency cross-check (see
 * the module-header flag): the schema gives this layer no "card currency"
 * to validate against, since FinanceCreditCardCharge.statementId replaces
 * the source's free-floating source_id+charge_date matching (source lines
 * 43-48, 291-294) with a hard FK straight to an already-created statement.
 */
export async function saveCardCharge(params: SaveCardChargeParams): Promise<InvoiceMutationResult> {
  const statement = await prisma.financeCreditCardStatement.findFirst({ where: { id: params.statementId } });
  if (!statement) return { ok: false, status: 400, error: "Select a statement to attach this charge to" };

  const existing = params.id ? await prisma.financeCreditCardCharge.findFirst({ where: { id: params.id } }) : null;
  if (params.id && !existing) return { ok: false, status: 404, error: "Charge not found" };

  const merchant = limitText(params.merchant ?? existing?.merchant ?? "", 180);
  if (!merchant) return { ok: false, status: 400, error: "Merchant is required" };

  const currencyResult = parseCurrency(params.currency ?? existing?.currency ?? "USD");
  if (!currencyResult.ok) return { ok: false, status: 400, error: currencyResult.error };
  const amountResult = parseMoney(params.amount !== undefined ? params.amount : existing?.amount);
  if (!amountResult.ok) return { ok: false, status: 400, error: amountResult.error };

  const reference = limitText(params.reference ?? existing?.reference ?? "", 160) || null;

  const data = {
    statementId: statement.id,
    merchant,
    amount: amountResult.value,
    currency: currencyResult.value,
    reference,
  };

  if (existing) {
    await prisma.financeCreditCardCharge.update({ where: { id: existing.id }, data });
    return { ok: true, id: existing.id };
  }
  const created = await prisma.financeCreditCardCharge.create({ data });
  return { ok: true, id: created.id };
}

export async function listCardCharges(statementId?: string) {
  return prisma.financeCreditCardCharge.findMany({
    where: statementId ? { statementId } : undefined,
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteCardCharge(
  id: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const existing = await prisma.financeCreditCardCharge.findFirst({ where: { id } });
  if (!existing) return { ok: false, status: 404, error: "Charge not found" };
  await prisma.financeCreditCardCharge.delete({ where: { id } });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Bank links — direct port of save_bank_link() / balances().
// ---------------------------------------------------------------------------

export type SaveBankLinkParams = {
  paymentSourceId: string;
  bankAccountId?: string | null;
  openingBalance?: number | null;
  openingAsOf?: Date | string | null;
};

/**
 * Direct port of save_bank_link(). FLAG — see the module-header note: the
 * schema has no manual-balance-currency field, so the source's "Opening
 * balance must be in the bank account currency" refusal (line 173) has no
 * field left to validate — the opening balance is implicitly always in the
 * linked FinancePaymentSource's own currency.
 */
export async function saveBankLink(params: SaveBankLinkParams): Promise<InvoiceMutationResult> {
  const sourceId = limitText(params.paymentSourceId, 90);
  const source = await prisma.financePaymentSource.findFirst({ where: { id: sourceId, kind: "Bank account" } });
  if (!source) return { ok: false, status: 400, error: "Select a registered bank account" };

  const bankAccountId = limitText(params.bankAccountId ?? "", 120) || null;
  if (bankAccountId) {
    const account = await prisma.financeBankAccount.findFirst({ where: { id: bankAccountId } });
    if (!account) return { ok: false, status: 400, error: "Unknown treasury bank account" };
  }

  let openingBalance: number | null = null;
  const raw = params.openingBalance;
  if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
    const result = parseSignedAmount(raw);
    if (!result.ok) return { ok: false, status: 400, error: result.error };
    openingBalance = result.value;
  }

  let openingAsOf: Date | null = null;
  if (openingBalance !== null) {
    if (!params.openingAsOf) return { ok: false, status: 400, error: "Manual balance needs an as-of date" };
    openingAsOf = toDateOnlyUTC(params.openingAsOf);
    if (!openingAsOf) return { ok: false, status: 400, error: "Use a valid date in YYYY-MM-DD format" };
  }

  const existing = await prisma.financeCreditBankLink.findUnique({ where: { paymentSourceId: sourceId } });
  const data = { paymentSourceId: sourceId, bankAccountId, openingBalance, openingAsOf };

  if (existing) {
    await prisma.financeCreditBankLink.update({ where: { paymentSourceId: sourceId }, data });
    return { ok: true, id: existing.id };
  }
  const created = await prisma.financeCreditBankLink.create({ data });
  return { ok: true, id: created.id };
}

export async function getBankLink(paymentSourceId: string) {
  return prisma.financeCreditBankLink.findUnique({ where: { paymentSourceId } });
}

export async function deleteBankLink(
  paymentSourceId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const existing = await prisma.financeCreditBankLink.findUnique({ where: { paymentSourceId } });
  if (!existing) return { ok: false, status: 404, error: "Bank link not found" };
  await prisma.financeCreditBankLink.delete({ where: { paymentSourceId } });
  return { ok: true };
}

export type BankBalance = {
  sourceId: string;
  account: string;
  currency: string;
  balance: number | null;
  asOf: Date | null;
  source: "ERP-reported" | "Manual, unverified" | "No balance";
  bankAccountId: string | null;
};

/**
 * Direct port of bank_sources() + balances(). An ERP-reported balance
 * (FinanceErpBankBalance, matched via FinanceCreditBankLink.bankAccountId
 * -> FinanceBankAccount.erpAccountId -> FinanceErpBankBalance.
 * externalAccountId) wins over the manual opening-balance snapshot, same
 * priority order as the source. Unlike the source, there's no
 * manual-balance currency field to prefer — the account's own currency is
 * always used when no ERP match exists.
 */
export async function listBankBalances(): Promise<BankBalance[]> {
  const [accounts, links] = await Promise.all([
    prisma.financePaymentSource.findMany({ where: { kind: "Bank account" } }),
    prisma.financeCreditBankLink.findMany(),
  ]);
  const linkBySource = new Map(links.map((l) => [l.paymentSourceId, l]));

  const bankAccountIds = links.map((l) => l.bankAccountId).filter((x): x is string => Boolean(x));
  const bankAccounts = bankAccountIds.length
    ? await prisma.financeBankAccount.findMany({ where: { id: { in: bankAccountIds } } })
    : [];
  const bankAccountById = new Map(bankAccounts.map((a) => [a.id, a]));

  const erpAccountIds = bankAccounts.map((a) => a.erpAccountId).filter((x): x is string => Boolean(x));
  const erpBalances = erpAccountIds.length
    ? await prisma.financeErpBankBalance.findMany({
        where: { externalAccountId: { in: erpAccountIds } },
        orderBy: { asOf: "desc" },
      })
    : [];
  const latestErpByAccount = new Map<string, (typeof erpBalances)[number]>();
  for (const row of erpBalances) {
    if (!latestErpByAccount.has(row.externalAccountId)) latestErpByAccount.set(row.externalAccountId, row);
  }

  return accounts.map((acc) => {
    const link = linkBySource.get(acc.id);
    const bankAccount = link?.bankAccountId ? bankAccountById.get(link.bankAccountId) : undefined;
    const match = bankAccount?.erpAccountId ? latestErpByAccount.get(bankAccount.erpAccountId) : undefined;

    const balance = match
      ? match.availableBalance ?? match.ledgerBalance ?? null
      : link?.openingBalance ?? null;
    const currency = match?.currency ?? acc.currency ?? "USD";
    const asOf = match?.asOf ?? link?.openingAsOf ?? null;
    const source: BankBalance["source"] = match ? "ERP-reported" : balance !== null ? "Manual, unverified" : "No balance";

    return {
      sourceId: acc.id,
      account: acc.name,
      currency,
      balance,
      asOf,
      source,
      bankAccountId: link?.bankAccountId ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// projection() — direct port of the source's projection().
// ---------------------------------------------------------------------------

export type CashEvent = {
  date: string; // YYYY-MM-DD
  kind: string;
  label: string;
  amount: number;
  currency: string;
  bankSourceId: string;
  paymentSourceId: string;
  certainty: string;
  note: string;
  reference: string;
  detailId: string | null;
};

export type CardCycleRow = {
  cardRuleId: string;
  currency: string;
  periodStart: string;
  closingDate: string;
  dueDate: string;
  chargeTotal: number;
  amountDue: number | null;
  estimatedBalanceBeforePayment: number;
  estimatedCarryForward: number;
  paymentKind: string;
  accuracy: string;
  hasStatement: boolean;
  bankSourceId: string;
};

export type AccountProjection = BankBalance & {
  forecastBalance: number | null;
  knownOutflows: number;
  unconverted: number;
};

export type ProjectionResult = {
  from: string;
  to: string;
  totalsByCurrency: Record<string, number>;
  events: CashEvent[];
  overdue: CashEvent[];
  cycles: CardCycleRow[];
  accounts: AccountProjection[];
  unassignedCount: number;
  unassignedByCurrency: Record<string, number>;
  limitations: string[];
};

function pushEvent(
  events: CashEvent[],
  overdue: CashEvent[],
  startIso: string,
  endIso: string,
  e: Omit<CashEvent, "amount"> & { amount: number }
): void {
  const amount = Math.round(e.amount * 100) / 100;
  if (amount <= 0) return;
  const rounded: CashEvent = { ...e, amount };
  if (rounded.date < startIso) overdue.push(rounded);
  else if (rounded.date <= endIso) events.push(rounded);
}

/**
 * Direct port of the source's projection(): a forward cash-outflow
 * timeline per bank account, combining AP invoices, expanded recurring
 * bills, and company-card settlement cycles, reconciled against the
 * latest known bank balance.
 *
 * Deliberately does NOT read any sales/collections/revenue data — see the
 * "NO NETTING" invariant documented at the top of this file. The
 * `limitations` entry on the result mirrors the source's own disclaimer
 * text verbatim where still accurate.
 */
export async function projection(params?: {
  start?: Date | string;
  months?: number;
  includePayroll?: boolean;
}): Promise<ProjectionResult> {
  const includePayroll = params?.includePayroll ?? true;
  const todayUTC = new Date();
  const today = new Date(Date.UTC(todayUTC.getUTCFullYear(), todayUTC.getUTCMonth(), todayUTC.getUTCDate()));
  const start = (params?.start !== undefined ? toDateOnlyUTC(params.start) : null) ?? today;
  const months = Math.max(1, Math.min(18, Math.trunc(params?.months ?? 4)));

  const zeroIdx = start.getUTCMonth();
  const totalMonths = zeroIdx + months;
  const endYear = start.getUTCFullYear() + Math.floor(totalMonths / 12);
  const endMonth1 = (totalMonths % 12) + 1;
  const end = addDaysUTC(utcDate(endYear, endMonth1, 1), -1);

  const startIso = isoDate(start);
  const endIso = isoDate(end);

  const events: CashEvent[] = [];
  const overdue: CashEvent[] = [];

  // --- Invoices (credit_cycles.py lines 273-276) ---
  const invoices = await prisma.financeCreditInvoice.findMany({
    where: { status: { notIn: ["Paid", "Cancelled"] } },
  });
  for (const v of invoices) {
    if (!v.dueDate) continue;
    const label = v.vendor + (v.invoiceNumber ? ` · ${v.invoiceNumber}` : "");
    pushEvent(events, overdue, startIso, endIso, {
      date: isoDate(toDateOnlyUTC(v.dueDate) ?? v.dueDate),
      kind: "Invoice",
      label,
      amount: v.amount,
      currency: v.currency,
      bankSourceId: v.paymentSourceId ?? "",
      paymentSourceId: "",
      certainty: "Scheduled invoice",
      note: v.notes ?? "",
      reference: v.invoiceNumber ?? "",
      detailId: v.id,
    });
  }

  // --- Recurring bills (credit_cycles.py lines 277-281) ---
  const recurring = await prisma.financeCreditRecurring.findMany({
    where: {
      active: true,
      ...(includePayroll ? {} : { category: { not: "Salary" } }),
    },
  });
  for (const x of recurring) {
    const dates = expandRecurrence(x, start, end);
    for (const day of dates) {
      const label = x.title + (x.beneficiary ? ` · ${x.beneficiary}` : "");
      pushEvent(events, overdue, startIso, endIso, {
        date: isoDate(day),
        kind: x.category,
        label,
        amount: x.amount,
        currency: x.currency,
        bankSourceId: x.paymentSourceId ?? "",
        paymentSourceId: "",
        certainty: "Recurring rule",
        note: x.notes ?? "",
        reference: x.id,
        detailId: x.id,
      });
    }
  }

  // --- Company-card settlement cycles (credit_cycles.py lines 282-318) ---
  const lookbackStart = addDaysUTC(start, -110);
  const expandedEnd = addDaysUTC(end, 80);
  const cardRules = await prisma.financeCreditCardRule.findMany({ include: { statements: true } });

  const accountIds = cardRules.map((r) => r.paymentAccountId).filter((x): x is string => Boolean(x));
  const accountCurrencyById = new Map<string, string>();
  if (accountIds.length) {
    const accounts = await prisma.financePaymentSource.findMany({ where: { id: { in: accountIds } } });
    for (const a of accounts) accountCurrencyById.set(a.id, a.currency ?? "USD");
  }

  const cycles: CardCycleRow[] = [];
  for (const rule of cardRules) {
    const currency = rule.paymentAccountId ? accountCurrencyById.get(rule.paymentAccountId) ?? "USD" : "USD";
    const statementByClose = new Map(rule.statements.map((s) => [isoDate(toDateOnlyUTC(s.closingDate) ?? s.closingDate), s]));
    const closeDates = generateStatementCloseDates(rule.statementDay, lookbackStart, expandedEnd);

    let carry = 0;
    for (let i = 0; i < closeDates.length; i++) {
      const close = closeDates[i];
      const prev = i > 0 ? closeDates[i - 1] : addDaysUTC(close, -31);
      const stmt = statementByClose.get(isoDate(close));
      const due = addDaysUTC(close, rule.dueOffsetDays);

      let balanceBefore: number;
      let pay: number | null;
      let kind: string;
      let accuracy: string;
      let chargeTotal = 0;

      if (stmt) {
        const full = Math.max(0, Math.round((stmt.amount - stmt.amountPaid) * 100) / 100);
        if (rule.settlement === "Full statement") {
          pay = full;
          kind = "Statement outstanding";
        } else if (stmt.minimumDue !== null) {
          pay = Math.max(0, Math.round((Math.min(stmt.amount, stmt.minimumDue) - stmt.amountPaid) * 100) / 100);
          kind = "Statement minimum (confirmed)";
        } else {
          pay = null;
          kind = "Minimum unknown";
        }
        if (stmt.status === "Paid") pay = 0;
        accuracy = "Statement entered";
        balanceBefore = stmt.status === "Paid" ? 0 : full;
        chargeTotal = stmt.amount;
      } else {
        // No statement exists yet for this cycle. Unlike the source,
        // charges can't accrue independently of a statement here (see the
        // module-header flag on FinanceCreditCardCharge.statementId being
        // required), so there is nothing to estimate from — only the
        // carried-forward balance from the prior cycle is known.
        balanceBefore = Math.round(carry * 100) / 100;
        pay = null;
        kind = carry > 0 ? "Balance carried, confirm statement" : "Statement not yet recorded";
        accuracy = "Needs actual statement";
      }

      const nextCarry = Math.max(0, Math.round((balanceBefore - (pay ?? 0)) * 100) / 100);
      carry = nextCarry;

      const row: CardCycleRow = {
        cardRuleId: rule.id,
        currency,
        periodStart: isoDate(addDaysUTC(prev, 1)),
        closingDate: isoDate(close),
        dueDate: isoDate(due),
        chargeTotal,
        amountDue: pay,
        estimatedBalanceBeforePayment: balanceBefore,
        estimatedCarryForward: nextCarry,
        paymentKind: kind,
        accuracy,
        hasStatement: Boolean(stmt),
        bankSourceId: rule.paymentAccountId ?? "",
      };
      if (startIso <= row.dueDate && row.dueDate <= endIso) cycles.push(row);

      if (pay !== null && pay > 0) {
        pushEvent(events, overdue, startIso, endIso, {
          date: isoDate(due),
          kind: "Card settlement",
          label: `Card cycle ${rule.id} · ${kind}`,
          amount: pay,
          currency,
          bankSourceId: rule.paymentAccountId ?? "",
          paymentSourceId: "",
          certainty: accuracy,
          note: `Closes ${isoDate(close)}. Charges after closing date belong to next cycle.`,
          reference: isoDate(close),
          detailId: rule.id,
        });
      }
    }
  }

  events.sort((a, b) =>
    a.date < b.date
      ? -1
      : a.date > b.date
        ? 1
        : a.kind < b.kind
          ? -1
          : a.kind > b.kind
            ? 1
            : a.label < b.label
              ? -1
              : a.label > b.label
                ? 1
                : 0
  );
  overdue.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const totalsByCurrency: Record<string, number> = {};
  for (const x of events) {
    totalsByCurrency[x.currency] = Math.round(((totalsByCurrency[x.currency] ?? 0) + x.amount) * 100) / 100;
  }

  const bankAccounts = await listBankBalances();
  const accounts: AccountProjection[] = bankAccounts.map((account) => {
    const booked = events.filter((e) => e.bankSourceId === account.sourceId);
    let projected: number | null;
    let effectiveBooked = booked;
    if (account.balance !== null) {
      const asOfIso = account.asOf ? isoDate(account.asOf) : null;
      const effective = asOfIso && asOfIso > startIso ? asOfIso : startIso;
      effectiveBooked = booked.filter((e) => e.date > effective);
      const outflow = effectiveBooked.filter((e) => e.currency === account.currency).reduce((s, e) => s + e.amount, 0);
      projected = Math.round((account.balance - outflow) * 100) / 100;
    } else {
      projected = null;
    }
    const knownOutflows =
      Math.round(effectiveBooked.filter((e) => e.currency === account.currency).reduce((s, e) => s + e.amount, 0) * 100) /
      100;
    const unconverted = effectiveBooked.filter((e) => e.currency !== account.currency).length;
    return { ...account, forecastBalance: projected, knownOutflows, unconverted };
  });

  const unassigned = events.filter((e) => !e.bankSourceId);
  const unassignedCurrencies = Array.from(new Set(unassigned.map((e) => e.currency))).sort();
  const unassignedByCurrency: Record<string, number> = {};
  for (const cur of unassignedCurrencies) {
    unassignedByCurrency[cur] =
      Math.round(unassigned.filter((e) => e.currency === cur).reduce((s, e) => s + e.amount, 0) * 100) / 100;
  }

  return {
    from: startIso,
    to: endIso,
    totalsByCurrency,
    events,
    overdue,
    cycles,
    accounts,
    unassignedCount: unassigned.length,
    unassignedByCurrency,
    limitations: [
      "Forward cash projection counts known outflows only, not future sales receipts.",
      "Bank balances are ERP-reported or manual snapshots, not independently verified.",
      "Card minimum payment requires the actual statement minimum.",
      "Amounts of different currencies are never summed without transaction-date exchange rates.",
      "Marked Paid invoices are excluded from future commitments; confirm bank settlement before marking paid.",
    ],
  };
}
