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

// Approved management cost heads under which a source payment must already
// be classified before it can receive personnel-cost attribution lines.
const PERSON_COST_HEADS = new Set(
  [
    "Salaries",
    "Commissions",
    "Commissions Agent",
    "Bonuses & Incentives",
    "Employer Payroll Taxes",
    "Staff Benefits & Pensions",
  ].map((h) => h.toLowerCase())
);

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
  active?: boolean;
  actorId: string;
  actorEmail: string;
}): Promise<SavePersonResult> {
  const ident = (params.id ?? "").trim();
  const name = (params.name ?? "").trim().split(/\s+/).join(" ");
  const dep = (params.department ?? "").trim();
  const active = params.active === false ? false : true;

  if (name.length < 2 || name.length > 160) {
    return { ok: false, status: 400, error: "Employee name must be 2 to 160 characters." };
  }

  const approvedDept = await prisma.financeManagementDepartment.findFirst({ where: { name: dep } });
  if (!approvedDept) return { ok: false, status: 400, error: "Choose an existing approved department." };

  const dup = await prisma.financePerson.findFirst({
    where: { fullName: name, ...(ident ? { id: { not: ident } } : {}) },
  });
  if (dup) return { ok: false, status: 409, error: "An employee with this name is already registered." };

  if (ident) {
    const existing = await prisma.financePerson.findUnique({ where: { id: ident } });
    if (!existing) return { ok: false, status: 404, error: "Employee record not found." };
    await prisma.financePerson.update({
      where: { id: ident },
      data: { fullName: name, department: dep, active },
    });
    return { ok: true, id: ident };
  }

  const created = await prisma.financePerson.create({
    data: { fullName: name, department: dep, active },
  });
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
  };
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

/**
 * Direct port of save_person_payment() — replaces the full set of
 * personnel cost-allocation lines attributed to one source payment.
 * Preserves, exactly:
 *  - the effective-cost-head gate (payment must already be classified
 *    under an approved people-cost head before it can carry personnel
 *    lines), computed the same way as the source's
 *    COALESCE(allocation.costHead, legacyMapping.costHead, originalHead) —
 *    only enforced when `lines` is non-empty, so clearing allocations on
 *    an unclassified payment is still allowed;
 *  - the mutual-exclusion guard against an existing FinancePaymentCostSplit;
 *  - the "same sign as the source payment, and non-zero" rule per line;
 *  - the "sum of lines must not exceed the source payment" hard invariant;
 *  - the point-in-time department snapshot (read from FinancePerson.department
 *    at attribution time, written into departmentSnapshot, and never
 *    re-derived afterward).
 */
export async function savePersonPayment(params: {
  transactionId: string;
  lines: PersonPaymentLine[];
  actorId: string;
  actorEmail: string;
}): Promise<SavePersonPaymentResult> {
  const ident = (params.transactionId ?? "").trim();
  const lines = params.lines;

  if (!Array.isArray(lines) || lines.length > 300) {
    return { ok: false, status: 400, error: "Supply up to 300 person allocations per payment." };
  }
  if (!ident) return { ok: false, status: 400, error: "Choose an existing source payment." };

  const tx = await prisma.financeTransaction.findUnique({
    where: { id: ident },
    include: { allocation: true },
  });
  if (!tx) return { ok: false, status: 404, error: "Original payment not found." };

  if (lines.length > 0) {
    let effectiveCostHead: string | null = tx.allocation?.costHead?.trim() || null;
    if (!effectiveCostHead && tx.originalHead) {
      const mapping = await prisma.financeLegacyMapping.findFirst({
        where: { legacyHead: tx.originalHead, legacyCentre: tx.originalCentre ?? "" },
      });
      effectiveCostHead = mapping?.costHead || null;
    }
    if (!effectiveCostHead) effectiveCostHead = tx.originalHead;
    if (!effectiveCostHead || !PERSON_COST_HEADS.has(effectiveCostHead.toLowerCase())) {
      return {
        ok: false,
        status: 400,
        error:
          "This payment must first be classified under a salary, commission or other approved people-cost head in Organise Costs.",
      };
    }
  }

  const existingSplit = await prisma.financePaymentCostSplit.findUnique({ where: { transactionId: ident } });
  if (existingSplit) {
    return {
      ok: false,
      status: 409,
      error: "A shared-cost split exists for this payment. Undo that split before attributing personnel costs.",
    };
  }

  const personIds = Array.from(
    new Set(lines.map((l) => String(l?.personId ?? "")).filter((id) => id.length > 0))
  );
  const people = personIds.length
    ? await prisma.financePerson.findMany({ where: { id: { in: personIds } } })
    : [];
  const peopleById = new Map(people.map((p) => [p.id, p]));

  const sourceCents = Math.round(tx.amountUsd * 100);
  type NewLine = {
    id: string;
    personId: string;
    costType: string;
    amountUsd: number;
    departmentSnapshot: string | null;
    reference: string;
    note: string;
  };
  const newLines: NewLine[] = [];
  let totalCents = 0;

  for (const line of lines) {
    const person = peopleById.get(String(line?.personId ?? ""));
    if (!person) return { ok: false, status: 400, error: "Choose a registered employee on every line." };

    const costType = String(line?.costType ?? "").trim();
    if (!PERSON_COST_TYPE_SET.has(costType)) {
      return { ok: false, status: 400, error: "Invalid personnel cost type." };
    }

    const cents = parseMoneyToCents(line?.amountUsd);
    if (cents === null) {
      return {
        ok: false,
        status: 400,
        error: "Enter a finite USD amount to two decimal places for each person.",
      };
    }
    if (!cents || (sourceCents > 0 && cents < 0) || (sourceCents < 0 && cents > 0)) {
      return { ok: false, status: 400, error: "Each allocation must have the same sign as the original payment." };
    }

    const reference = String(line?.reference ?? "").trim().slice(0, 180);
    const note = String(line?.note ?? "").trim().slice(0, 500);

    newLines.push({
      id: randomUUID(),
      personId: person.id,
      costType,
      amountUsd: cents / 100,
      // Point-in-time snapshot — taken from the person's CURRENT
      // department at the moment of attribution, then frozen. Must never
      // be re-derived from FinancePerson.department later.
      departmentSnapshot: person.department,
      reference,
      note,
    });
    totalCents += cents;
  }

  if (Math.abs(totalCents) > Math.abs(sourceCents)) {
    return {
      ok: false,
      status: 400,
      error: "Person allocations exceed the original payment. Total cannot be more than the payment.",
    };
  }

  const existing = await prisma.financePersonCostAllocation.findMany({
    where: { transactionId: ident },
    select: { id: true },
  });
  const touched = [...existing.map((e) => e.id), ...newLines.map((l) => l.id)];
  const before = await revisionItems("FinancePersonCostAllocation", touched);

  await prisma.financePersonCostAllocation.deleteMany({ where: { transactionId: ident } });
  for (const line of newLines) {
    await prisma.financePersonCostAllocation.create({
      data: {
        id: line.id,
        transactionId: ident,
        personId: line.personId,
        costType: line.costType,
        amountUsd: line.amountUsd,
        departmentSnapshot: line.departmentSnapshot,
        reference: line.reference,
        note: line.note,
      },
    });
  }

  const after = await revisionItems("FinancePersonCostAllocation", touched);
  const changeId = await logReversible({
    organizationId: tx.organizationId,
    action: "person_cost_allocation",
    description: `Personnel cost assignment · ${ident}`,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    before,
    after,
  });

  return {
    ok: true,
    transactionId: ident,
    allocatedUsd: totalCents / 100,
    unallocatedUsd: (sourceCents - totalCents) / 100,
    changeId,
  };
}
