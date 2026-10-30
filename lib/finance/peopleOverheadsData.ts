import { randomUUID } from "crypto";
import { prisma } from "../prisma";
import { logReversible, revisionItems } from "./changeJournal";

// People & Overheads business logic, ported from the source Python app's
// server.py (`overhead_pair`, `change_overhead_rule`, `change_overhead_payments`,
// `apply_suggested_overheads`, `save_person`, `person_cost_state`,
// `save_person_payment`) and docs/PEOPLE_AND_OVERHEADS.md +
// docs/ARCHITECTURE.md's "Immutable records and separate management layers"
// section. Two hard invariants carried over verbatim from the source:
//   1. The sum of a payment's person-cost-allocation lines must never
//      exceed the source payment's amount (reject, don't clamp).
//   2. `departmentSnapshot` on FinancePersonCostAllocation is captured at
//      attribution time and is NEVER re-derived from the person's current
//      department later (a transfer must not rewrite history).
// A payment with an approved FinancePaymentCostSplit is mutually exclusive
// with personnel-cost attribution — the same guard the source enforces
// against `payment_cost_splits` before `save_person_payment` is allowed to
// proceed.

// --- Shared cost-nature/cost-behaviour tagging (overhead_pair) ---------

export type OverheadNature = "overhead" | "direct" | "balance" | "review";
export type OverheadBehaviour = "fixed" | "variable" | "mixed" | "oneoff" | "na";

const OVERHEAD_NATURES = new Set(["overhead", "direct", "balance", "review"]);
const OVERHEAD_BEHAVIOURS = new Set(["fixed", "variable", "mixed", "oneoff", "na"]);

type OverheadPairResult =
  | { ok: true; nature: string; behaviour: string }
  | { ok: false; error: string };

/**
 * Direct port of overhead_pair(). Returns ("", "") when both inputs are
 * blank (meaning "clear any existing tag") — this is a valid, non-error
 * input, not a validation failure. Hard rules preserved exactly:
 *  - nature/behaviour must each be one of the approved sets;
 *  - 'balance' or 'review' natures must use 'na' behaviour;
 *  - 'direct' costs must NOT use 'na' — a real behaviour is required.
 */
function overheadPair(nature: string | undefined, behaviour: string | undefined): OverheadPairResult {
  const n = (nature ?? "").trim().toLowerCase();
  const b = (behaviour ?? "").trim().toLowerCase();
  if (!n && !b) return { ok: true, nature: "", behaviour: "" };
  if (!OVERHEAD_NATURES.has(n) || !OVERHEAD_BEHAVIOURS.has(b)) {
    return { ok: false, error: "Choose an approved cost nature and cost behaviour." };
  }
  if ((n === "balance" || n === "review") && b !== "na") {
    return { ok: false, error: "Balance-sheet or pending-review movements must use N/A behaviour." };
  }
  if (n === "direct" && b === "na") {
    return { ok: false, error: "Direct costs require a cost behaviour." };
  }
  return { ok: true, nature: n, behaviour: b };
}

export type ChangeOverheadRuleResult =
  | { ok: true; changeId: string }
  | { ok: false; status: number; error: string };

/**
 * Direct port of change_overhead_rule() — tags (or clears, when nature is
 * blank) the cost-head-level overhead nature/behaviour rule. Mirrors the
 * source's exact validation order: the nature/behaviour combination is
 * checked before the cost-head-blank check, which runs before the
 * approved-catalogue check. Undoable via FinanceOverheadHeadRule, which
 * changeJournal.ts already treats as compound-unique (organizationId,
 * costHead) internally.
 */
export async function changeOverheadRule(params: {
  costHead: string;
  nature?: string;
  behaviour?: string;
  actorId: string;
  actorEmail: string;
}): Promise<ChangeOverheadRuleResult> {
  const head = (params.costHead ?? "").trim();
  const pair = overheadPair(params.nature, params.behaviour);
  if (!pair.ok) return { ok: false, status: 400, error: pair.error };
  if (!head) return { ok: false, status: 400, error: "Choose a cost head." };

  const approved = await prisma.financeManagementCostHead.findFirst({ where: { name: head } });
  if (!approved) return { ok: false, status: 400, error: "Cost head is not in the approved catalogue." };

  const existingRule = await prisma.financeOverheadHeadRule.findFirst({ where: { costHead: head } });
  const before = await revisionItems("FinanceOverheadHeadRule", [head]);

  let organizationId: string | null = existingRule?.organizationId ?? null;
  if (pair.nature) {
    if (existingRule) {
      const updated = await prisma.financeOverheadHeadRule.update({
        where: { id: existingRule.id },
        data: { costNature: pair.nature, costBehaviour: pair.behaviour },
      });
      organizationId = updated.organizationId;
    } else {
      const created = await prisma.financeOverheadHeadRule.create({
        data: { costHead: head, costNature: pair.nature, costBehaviour: pair.behaviour },
      });
      organizationId = created.organizationId;
    }
  } else if (existingRule) {
    await prisma.financeOverheadHeadRule.delete({ where: { id: existingRule.id } });
  }

  const after = await revisionItems("FinanceOverheadHeadRule", [head]);
  const changeId = await logReversible({
    organizationId,
    action: "overhead_head_rule",
    description: `Overhead classification · ${head}`,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    before,
    after,
  });

  return { ok: true, changeId };
}

export type ChangeOverheadPaymentOverrideResult =
  | { ok: true; tagged: number; changeId: string }
  | { ok: false; status: number; error: string };

/**
 * Direct port of change_overhead_payments() — tags (or clears) up to 5,000
 * individual payments' overhead nature/behaviour, overriding any cost-head
 * rule for those specific transactions. Undoable via
 * FinanceOverheadPaymentOverride (transactionId is standalone-unique).
 */
export async function changeOverheadPaymentOverride(params: {
  ids?: string[];
  id?: string;
  nature?: string;
  behaviour?: string;
  actorId: string;
  actorEmail: string;
}): Promise<ChangeOverheadPaymentOverrideResult> {
  const rawIds = params.ids && params.ids.length ? params.ids : params.id ? [params.id] : [];
  if (!Array.isArray(rawIds) || rawIds.length === 0 || rawIds.length > 5000) {
    return { ok: false, status: 400, error: "Choose 1 to 5,000 payments." };
  }
  const ids = Array.from(new Set(rawIds.map((i) => String(i).trim())));

  const pair = overheadPair(params.nature, params.behaviour);
  if (!pair.ok) return { ok: false, status: 400, error: pair.error };

  const found = await prisma.financeTransaction.findMany({
    where: { id: { in: ids } },
    select: { id: true, organizationId: true },
  });
  if (found.length !== ids.length) {
    return { ok: false, status: 404, error: "One or more payment IDs were not found." };
  }

  const before = await revisionItems("FinanceOverheadPaymentOverride", ids);

  if (pair.nature) {
    for (const id of ids) {
      await prisma.financeOverheadPaymentOverride.upsert({
        where: { transactionId: id },
        create: { transactionId: id, costNature: pair.nature, costBehaviour: pair.behaviour },
        update: { costNature: pair.nature, costBehaviour: pair.behaviour },
      });
    }
  } else {
    await prisma.financeOverheadPaymentOverride.deleteMany({ where: { transactionId: { in: ids } } });
  }

  const after = await revisionItems("FinanceOverheadPaymentOverride", ids);
  const changeId = await logReversible({
    organizationId: found[0]?.organizationId ?? null,
    action: "overhead_payment_tag",
    description: `${ids.length} payment(s) overhead classification`,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    before,
    after,
  });

  return { ok: true, tagged: ids.length, changeId };
}

export type ApplySuggestedOverheadsResult =
  | { ok: true; applied: number; changeId: string | null }
  | { ok: false; status: number; error: string };

/**
 * Direct port of apply_suggested_overheads() — bulk-applies up to 100
 * suggested cost-head rules, but ONLY for cost heads that don't already
 * have a rule (an existing rule is silently left alone, not overwritten —
 * matching the source's `INSERT OR IGNORE`). Unlike changeOverheadRule, a
 * blank nature/behaviour pair is invalid here (every suggestion must carry
 * a real tag). Note the source checks the approved-cost-head catalogue
 * with an exact, case-sensitive match here (no `COLLATE NOCASE`, unlike
 * change_overhead_rule's lookup) — preserved as a case-sensitive Set
 * lookup, though it's moot in practice under this app's case-insensitive
 * default collation.
 */
export async function applySuggestedOverheads(params: {
  rules: Array<{ costHead: string; nature?: string; behaviour?: string }>;
  actorId: string;
  actorEmail: string;
}): Promise<ApplySuggestedOverheadsResult> {
  const rules = params.rules;
  if (!Array.isArray(rules) || rules.length > 100) {
    return { ok: false, status: 400, error: "Invalid suggestions list" };
  }

  const approvedHeads = new Set(
    (await prisma.financeManagementCostHead.findMany({ select: { name: true } })).map((h) => h.name)
  );

  const pending: string[] = [];
  const resolvedRules: Array<{ head: string; nature: string; behaviour: string }> = [];
  for (const rule of rules) {
    const head = String(rule?.costHead ?? "").trim();
    const pair = overheadPair(rule?.nature, rule?.behaviour);
    if (!pair.ok) return { ok: false, status: 400, error: pair.error };
    if (!approvedHeads.has(head) || !pair.nature) {
      return { ok: false, status: 400, error: "Invalid suggested cost head." };
    }
    resolvedRules.push({ head, nature: pair.nature, behaviour: pair.behaviour });
    const already = await prisma.financeOverheadHeadRule.findFirst({ where: { costHead: head } });
    if (!already && !pending.includes(head)) pending.push(head);
  }

  const before = await revisionItems("FinanceOverheadHeadRule", pending);

  let organizationId: string | null = null;
  const inserted = new Set<string>();
  for (const rule of resolvedRules) {
    if (pending.includes(rule.head) && !inserted.has(rule.head)) {
      const created = await prisma.financeOverheadHeadRule.create({
        data: { costHead: rule.head, costNature: rule.nature, costBehaviour: rule.behaviour },
      });
      organizationId = organizationId ?? created.organizationId;
      inserted.add(rule.head);
    }
  }

  const after = await revisionItems("FinanceOverheadHeadRule", pending);

  if (pending.length > 0) {
    const changeId = await logReversible({
      organizationId,
      action: "overhead_suggestions",
      description: `${pending.length} suggested overhead rules applied`,
      actorId: params.actorId,
      actorEmail: params.actorEmail,
      before,
      after,
    });
    return { ok: true, applied: pending.length, changeId };
  }

  return { ok: true, applied: 0, changeId: null };
}

/**
 * Listing helper for the Overhead Analysis screen — there is no
 * equivalent read in the source app's server.py beyond what fetch_state
 * already returns for transactions, so this is a small addition (not a
 * port) that simply surfaces every FinanceOverheadHeadRule row keyed by
 * cost head, for pairing against FinanceState.managementCostHeads client-side.
 */
export async function listOverheadHeadRules() {
  const rules = await prisma.financeOverheadHeadRule.findMany({ orderBy: { costHead: "asc" } });
  return rules.map((r) => ({
    costHead: r.costHead,
    costNature: r.costNature,
    costBehaviour: r.costBehaviour,
    updatedAt: r.updatedAt,
  }));
}

// --- Personnel cost attribution ----------------------------------------

export const PERSON_COST_TYPES = [
  "Salary",
  "Commission",
  "Bonus",
  "Employer taxes",
  "Benefits",
  "Other personnel",
] as const;
const PERSON_COST_TYPE_SET = new Set<string>(PERSON_COST_TYPES);

export type SavePersonResult = { ok: true; id: string } | { ok: false; status: number; error: string };

/**
 * Direct port of save_person() — create/update an employee record.
 * Note: the Prisma schema marks FinancePerson.department as nullable
 * (String?), but the source's business rule requires a real, approved
 * department on every person; that stricter rule is enforced here even
 * though the column itself permits null.
 */
export async function savePerson(params: {
  id?: string;
  name: string;
  department: string;
  jobTitle?: string;
  email?: string;
  paymentAlias?: string;
  active?: boolean;
  actorId: string;
  actorEmail: string;
}): Promise<SavePersonResult> {
  const ident = (params.id ?? "").trim();
  const name = (params.name ?? "").trim().split(/\s+/).join(" ");
  const dep = (params.department ?? "").trim();
  const jobTitle = (params.jobTitle ?? "").trim().slice(0, 160);
  const email = (params.email ?? "").trim().toLowerCase().slice(0, 200);
  const paymentAlias = (params.paymentAlias ?? "").trim().slice(0, 200);
  const active = params.active === false ? false : true;

  // v41 people_costs.save_person(): name, approved department and job title are required;
  // email is optional but unique; the source no longer rejects two people with the same name.
  if (name.length < 2 || name.length > 160 || name.startsWith("=")) {
    return { ok: false, status: 400, error: "Employee name must be 2 to 160 characters." };
  }

  const approvedDept = await prisma.financeManagementDepartment.findFirst({ where: { name: dep } });
  if (!approvedDept) return { ok: false, status: 400, error: "Choose an existing approved department." };
  if (!jobTitle) return { ok: false, status: 400, error: "Job Title is required." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, status: 400, error: "Invalid email address." };
  }
  if (email) {
    const dupe = await prisma.financePerson.findFirst({
      where: { email, ...(ident ? { id: { not: ident } } : {}) },
      select: { id: true },
    });
    if (dupe) return { ok: false, status: 409, error: "That email is already assigned to another employee." };
  }

  const data = { fullName: name, department: dep, jobTitle, email, paymentAlias, active };
  if (ident) {
    const existing = await prisma.financePerson.findFirst({ where: { id: ident }, select: { id: true } });
    if (!existing) return { ok: false, status: 404, error: "Employee record not found." };
    await prisma.financePerson.update({ where: { id: ident }, data });
    return { ok: true, id: ident };
  }

  const created = await prisma.financePerson.create({ data });
  return { ok: true, id: created.id };
}

/**
 * Direct port of person_cost_state() — a read-only summary joining every
 * person-cost allocation back to its source payment and employee, for the
 * People Costs screen's "Total Cost per Person" reporting.
 */
export async function getPersonCostState() {
  const [people, allocations] = await Promise.all([
    prisma.financePerson.findMany({ orderBy: { fullName: "asc" } }),
    prisma.financePersonCostAllocation.findMany({
      orderBy: [{ transaction: { month: "desc" } }, { person: { fullName: "asc" } }],
      include: {
        transaction: { select: { description: true, month: true, paymentDate: true, amountUsd: true } },
        person: { select: { fullName: true } },
      },
    }),
  ]);

  return {
    people,
    allocations: allocations.map((a) => ({
      id: a.id,
      transactionId: a.transactionId,
      personId: a.personId,
      costType: a.costType,
      amountUsd: a.amountUsd,
      departmentSnapshot: a.departmentSnapshot,
      jobTitleSnapshot: a.jobTitleSnapshot,
      reference: a.reference,
      note: a.note,
      updatedAt: a.updatedAt,
      paymentDescription: a.transaction.description,
      month: a.transaction.month,
      paymentDate: a.transaction.paymentDate,
      paymentAmount: a.transaction.amountUsd,
      personName: a.person.fullName,
    })),
    costTypes: [...PERSON_COST_TYPES].slice().sort(),
    suggestions: await paymentSuggestions(people, new Set(allocations.map((a) => a.transactionId))),
  };
}

export type PaymentSuggestion = {
  transactionId: string;
  personId: string;
  personName: string;
  jobTitle: string;
  department: string | null;
  description: string;
  month: string;
  paymentDate: Date | null;
  costType: string;
  amountUsd: number;
  reason: string;
};

const matchNorm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^\p{L}\p{N}_]+/gu, " ").trim();

function suggestionType(t: { originalCentre: string | null; originalHead: string | null; description: string }) {
  const s = `${t.originalCentre ?? ""} ${t.originalHead ?? ""} ${t.description}`.toLowerCase();
  if (s.includes("commission")) return "Commission";
  if (s.includes("salary") || s.includes("payroll")) return "Salary";
  if (s.includes("bonus") || s.includes("incentive")) return "Bonus";
  return null;
}

/**
 * v41 people_costs.suggestions(): an unallocated, positive salary/commission/bonus payment whose
 * description contains exactly ONE active employee's full name or payment alias (5+ characters,
 * whole words). Ambiguous matches are skipped; nothing is applied until Finance links them.
 */
export async function paymentSuggestions(
  people: { id: string; fullName: string; paymentAlias: string; jobTitle: string; department: string | null; active: boolean }[],
  allocated: Set<string>,
): Promise<PaymentSuggestion[]> {
  const active = people
    .filter((p) => p.active)
    .map((p) => ({ p, phrases: [p.fullName, p.paymentAlias].map(matchNorm).filter((x) => x.length >= 5) }));
  if (!active.length) return [];
  // Reuses the cached ledger (getFinanceState) instead of re-reading every payment from SQL.
  const { getFinanceState } = await import("./ledgerData");
  const key = (d: Date | string | null) => (d ? new Date(d).getTime() : 0);
  const txs = (await getFinanceState()).transactions
    .filter((t) => t.amount > 0)
    .map((t) => ({
      id: t.id,
      description: t.description,
      originalCentre: t.costCentre,
      originalHead: t.head,
      month: t.month,
      paymentDate: t.date,
      amountUsd: t.amount,
    }))
    .sort((a, b) => b.month.localeCompare(a.month) || key(b.paymentDate) - key(a.paymentDate) || (b.id > a.id ? 1 : b.id < a.id ? -1 : 0));
  const out: PaymentSuggestion[] = [];
  for (const t of txs) {
    if (allocated.has(t.id)) continue;
    const costType = suggestionType(t);
    if (!costType) continue;
    const desc = ` ${matchNorm(t.description)} `;
    const matched = active.filter(({ phrases }) => phrases.some((ph) => desc.includes(` ${ph} `)));
    if (matched.length !== 1) continue;
    const { p } = matched[0];
    out.push({
      transactionId: t.id,
      personId: p.id,
      personName: p.fullName,
      jobTitle: p.jobTitle,
      department: p.department,
      description: t.description,
      month: t.month,
      paymentDate: t.paymentDate,
      costType,
      amountUsd: Math.round(t.amountUsd * 100) / 100,
      reason: "Unique name or payment alias found in payroll/commission description",
    });
    if (out.length >= 300) break;
  }
  return out;
}

/**
 * v41 bulk_suggestions(): links reviewed suggestions. Re-derives the suggestions server-side and
 * refuses if any selected payment is no longer a current suggestion. One undoable change.
 */
export async function linkSuggestions(params: { transactionIds: string[]; actorId: string; actorEmail: string }) {
  const ids = params.transactionIds;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 300 || new Set(ids).size !== ids.length) {
    return { ok: false as const, status: 400, error: "Select 1 to 300 suggested payments." };
  }
  const [people, allocated] = await Promise.all([
    prisma.financePerson.findMany(),
    prisma.financePersonCostAllocation.findMany({ select: { transactionId: true }, distinct: ["transactionId"] }),
  ]);
  const current = new Map((await paymentSuggestions(people, new Set(allocated.map((a) => a.transactionId)))).map((s) => [s.transactionId, s]));
  if (ids.some((id) => !current.has(id))) {
    return { ok: false as const, status: 409, error: "Suggestions changed. Refresh and review current matches before saving." };
  }
  const txs = await prisma.financeTransaction.findMany({ where: { id: { in: ids } }, select: { id: true, organizationId: true, amountUsd: true } });
  const built: BuiltLine[] = [];
  let totalCents = 0;
  for (const tx of txs) {
    const s = current.get(tx.id)!;
    const result = await buildPaymentLines(tx, [
      { personId: s.personId, costType: s.costType, amountUsd: s.amountUsd.toFixed(2), reference: "Excel staff / transaction description match", note: "Reviewed suggested payment match" },
    ]);
    if (!result.ok) return { ...result, error: `${tx.id}: ${result.error}` };
    built.push(...result.lines);
    totalCents += result.totalCents;
  }
  const changeId = await writePaymentLines({
    organizationId: txs[0]?.organizationId ?? null,
    transactionIds: ids,
    built,
    action: "people_link_suggestions",
    description: `Matched payroll payments · ${ids.length} items`,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
  });
  return { ok: true as const, linked: ids.length, totalUsd: totalCents / 100, changeId };
}

/** Parses a money string/number into integer cents, requiring a finite value with at most 2 decimal places (mirrors the source's `Decimal(...).quantize('.01')` check — rejects, rather than rounds, anything more precise). */
function parseMoneyToCents(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(str)) return null;
  const value = Number(str);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export type SavePersonPaymentResult =
  | { ok: true; transactionId: string; allocatedUsd: number; unallocatedUsd: number; changeId: string }
  | { ok: false; status: number; error: string };

export type PersonPaymentLine = {
  personId: string;
  costType: string;
  amountUsd: number | string;
  reference?: string;
  note?: string;
};

type PaymentRow = { id: string; organizationId: string | null; amountUsd: number };
type BuiltLine = {
  id: string;
  transactionId: string;
  personId: string;
  costType: string;
  amountUsd: number;
  departmentSnapshot: string | null;
  jobTitleSnapshot: string;
  reference: string;
  note: string;
};
type BuildResult =
  | { ok: true; lines: BuiltLine[]; totalCents: number; sourceCents: number }
  | { ok: false; status: number; error: string };

/**
 * Validates the complete set of personnel lines for ONE payment (v41 people_costs.allocate()):
 *  - payments with a shared-cost split need Finance review first;
 *  - every line names a registered employee, a valid cost type and a positive USD amount to cents;
 *  - the lines never exceed the original (positive) payment, so spend is never duplicated;
 *  - department and job title are snapshotted from the person now and never re-derived.
 * v41 dropped the old "payment must already sit under a people-cost head" gate so any payment
 * (Browse: All payments) can be attributed.
 */
async function buildPaymentLines(tx: PaymentRow, lines: PersonPaymentLine[]): Promise<BuildResult> {
  if (!Array.isArray(lines) || lines.length > 100) {
    return { ok: false, status: 400, error: "Use 0 to 100 allocation lines per payment." };
  }
  const split = await prisma.financePaymentCostSplit.findFirst({ where: { transactionId: tx.id }, select: { id: true } });
  if (split) {
    return { ok: false, status: 409, error: "Split payments require Finance review before personnel attribution." };
  }

  const personIds = Array.from(new Set(lines.map((l) => String(l?.personId ?? "")).filter(Boolean)));
  const people = personIds.length ? await prisma.financePerson.findMany({ where: { id: { in: personIds } } }) : [];
  const peopleById = new Map(people.map((p) => [p.id, p]));

  const sourceCents = Math.round(tx.amountUsd * 100);
  const built: BuiltLine[] = [];
  let totalCents = 0;
  for (const line of lines) {
    const person = peopleById.get(String(line?.personId ?? ""));
    if (!person) return { ok: false, status: 400, error: "Choose a valid employee on every line." };
    const costType = String(line?.costType ?? "").trim();
    if (!PERSON_COST_TYPE_SET.has(costType)) return { ok: false, status: 400, error: "Choose a valid salary or commission type." };
    const cents = parseMoneyToCents(line?.amountUsd);
    if (cents === null) return { ok: false, status: 400, error: "Enter a valid USD amount to two decimal places." };
    if (cents <= 0) return { ok: false, status: 400, error: "Allocation amounts must be positive." };
    totalCents += cents;
    built.push({
      id: randomUUID(),
      transactionId: tx.id,
      personId: person.id,
      costType,
      amountUsd: cents / 100,
      departmentSnapshot: person.department,
      jobTitleSnapshot: person.jobTitle,
      reference: String(line?.reference ?? "").trim().slice(0, 180),
      note: String(line?.note ?? "").trim().slice(0, 500),
    });
  }
  if (sourceCents < 0 || totalCents > sourceCents) {
    return { ok: false, status: 400, error: "People costs exceed the original payment; splits cannot duplicate spend." };
  }
  return { ok: true, lines: built, totalCents, sourceCents };
}

/** Replaces all allocation lines of the given payments with `built`, as one undoable change. */
async function writePaymentLines(params: {
  organizationId: string | null;
  transactionIds: string[];
  built: BuiltLine[];
  action: string;
  description: string;
  actorId: string;
  actorEmail: string;
}): Promise<string> {
  const existing = await prisma.financePersonCostAllocation.findMany({
    where: { transactionId: { in: params.transactionIds } },
    select: { id: true },
  });
  const touched = [...existing.map((e) => e.id), ...params.built.map((l) => l.id)];
  const before = await revisionItems("FinancePersonCostAllocation", touched);
  await prisma.$transaction([
    prisma.financePersonCostAllocation.deleteMany({ where: { transactionId: { in: params.transactionIds } } }),
    ...params.built.map((line) => prisma.financePersonCostAllocation.create({ data: line })),
  ]);
  const after = await revisionItems("FinancePersonCostAllocation", touched);
  return logReversible({
    organizationId: params.organizationId,
    action: params.action,
    description: params.description,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    before,
    after,
  });
}

/** Port of /api/people/allocate: replaces the full personnel allocation of ONE payment. */
export async function savePersonPayment(params: {
  transactionId: string;
  lines: PersonPaymentLine[];
  actorId: string;
  actorEmail: string;
}): Promise<SavePersonPaymentResult> {
  const ident = (params.transactionId ?? "").trim();
  if (!ident) return { ok: false, status: 400, error: "Choose an existing source payment." };
  const tx = await prisma.financeTransaction.findFirst({ where: { id: ident }, select: { id: true, organizationId: true, amountUsd: true } });
  if (!tx) return { ok: false, status: 404, error: "Payment not found." };

  const result = await buildPaymentLines(tx, params.lines);
  if (!result.ok) return result;
  const changeId = await writePaymentLines({
    organizationId: tx.organizationId,
    transactionIds: [ident],
    built: result.lines,
    action: "person_cost_allocation",
    description: `People costs · ${ident}`,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
  });
  return {
    ok: true,
    transactionId: ident,
    allocatedUsd: result.totalCents / 100,
    unallocatedUsd: (result.sourceCents - result.totalCents) / 100,
    changeId,
  };
}

export type BatchItem = { transactionId: string; costType: string; amountUsd: number | string; reference?: string; note?: string };

/**
 * /api/people/allocate-batch (the v41 frontend's preferred endpoint): adds one line per selected
 * payment for ONE employee, keeping every existing line on those payments, validated payment by
 * payment and saved as a single undoable change. All-or-nothing: any invalid payment aborts the batch.
 */
export async function allocateBatch(params: {
  personId: string;
  items: BatchItem[];
  actorId: string;
  actorEmail: string;
}): Promise<{ ok: true; payments: number; allocatedUsd: number; changeId: string } | { ok: false; status: number; error: string }> {
  const items = params.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > 300) {
    return { ok: false, status: 400, error: "Select 1 to 300 payments." };
  }
  const ids = items.map((i) => String(i?.transactionId ?? ""));
  if (new Set(ids).size !== ids.length) return { ok: false, status: 400, error: "A payment was selected twice." };
  const person = await prisma.financePerson.findFirst({ where: { id: params.personId }, select: { id: true, fullName: true } });
  if (!person) return { ok: false, status: 400, error: "Choose a valid employee." };

  const [txs, existing] = await Promise.all([
    prisma.financeTransaction.findMany({ where: { id: { in: ids } }, select: { id: true, organizationId: true, amountUsd: true } }),
    prisma.financePersonCostAllocation.findMany({ where: { transactionId: { in: ids } } }),
  ]);
  const txById = new Map(txs.map((t) => [t.id, t]));
  const built: BuiltLine[] = [];
  let addedCents = 0;
  for (const item of items) {
    const tx = txById.get(item.transactionId);
    if (!tx) return { ok: false, status: 404, error: `Payment ${item.transactionId} not found.` };
    const kept: PersonPaymentLine[] = existing
      .filter((a) => a.transactionId === tx.id)
      .map((a) => ({ personId: a.personId, costType: a.costType, amountUsd: a.amountUsd.toFixed(2), reference: a.reference ?? "", note: a.note ?? "" }));
    const result = await buildPaymentLines(tx, [
      ...kept,
      { personId: person.id, costType: item.costType, amountUsd: item.amountUsd, reference: item.reference, note: item.note },
    ]);
    if (!result.ok) return { ...result, error: `${tx.id}: ${result.error}` };
    // Kept lines keep their original snapshots; only the new line takes today's department/title.
    const keptRows = existing.filter((a) => a.transactionId === tx.id);
    result.lines.forEach((line, i) => {
      if (i < keptRows.length) {
        line.departmentSnapshot = keptRows[i].departmentSnapshot;
        line.jobTitleSnapshot = keptRows[i].jobTitleSnapshot;
      }
    });
    addedCents += Math.round(result.lines[result.lines.length - 1].amountUsd * 100);
    built.push(...result.lines);
  }

  const changeId = await writePaymentLines({
    organizationId: txs[0]?.organizationId ?? null,
    transactionIds: ids,
    built,
    action: "person_cost_allocation_batch",
    description: `People costs · ${items.length} payments to ${person.fullName}`,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
  });
  return { ok: true, payments: items.length, allocatedUsd: addedCents / 100, changeId };
}
