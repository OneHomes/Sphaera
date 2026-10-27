import { prisma } from "../prisma";
import { logReversible, revisionItems } from "./changeJournal";

// Core ledger/taxonomy logic, ported from the source Python app's
// server.py (`fetch_state`, `classify`, `bulk_management_classify`,
// `valid_category`, `mark_disputed`, department/cost-head CRUD). This is
// the highest-stakes file in the whole port — it's the only sub-domain
// with real migrated production data (3,717 transactions, 1,452
// allocations) behind it.

export type FinanceLedgerRow = {
  id: string;
  month: string;
  date: Date;
  description: string;
  costCentre: string | null;
  head: string | null;
  assignedCentre: string | null;
  assignedHead: string | null;
  effectiveHead: string | null;
  effectiveCentre: string | null;
  amount: number;
  debtPeriod: string;
  reviewed: boolean;
  reviewGroup: string;
  note: string | null;
  // Resolved management classification — a per-payment override
  // (allocations.department/cost_head) always wins over a source-level
  // legacy mapping suggestion, exactly like the source's fetch_state.
  managementDepartment: string | null;
  managementCostHead: string | null;
  managementSource: string; // 'payment' | the mapping's own source ('suggested'|'pending'|...)
  hasManagementOverride: boolean;
  paymentReference: string;
  erpPaymentId: string;
  invoiceReference: string;
  traceSupplier: string;
  tracePurpose: string;
  paymentMethod: string;
  paymentSourceId: string;
  subscriptionId: string;
  sourceCurrency: string;
  sourceAmount: number | null;
  traceReviewed: boolean;
  reportingSupplier: string | null;
  supplierNameApproved: boolean;
  dispute: { status: string; reason: string | null; financeOwner: string | null } | null;
  departmentSplits: unknown[];
  splitApprovedAt: string | null;
  overheadOverride: { costNature: string; costBehaviour: string } | null;
  sourceSheet: string | null;
  sourceRow: number | null;
  sourceFile: string | null;
};

export type FinanceState = {
  transactions: FinanceLedgerRow[];
  monthly: Awaited<ReturnType<typeof prisma.financeMonthly.findMany>>;
  costHeads: Awaited<ReturnType<typeof prisma.financeCostHead.findMany>>;
  departments: string[];
  managementCostHeads: string[];
  legacyMappings: Awaited<ReturnType<typeof prisma.financeLegacyMapping.findMany>>;
  classifications: number;
};

/**
 * The mega-join powering most Finance ledger/reporting screens — direct
 * equivalent of the source's fetch_state(). Fetches every transaction
 * with its allocation/trace/dispute/split/overhead-override overlay,
 * resolves the effective management department/cost-head (per-payment
 * override > legacy mapping), and resolves the reporting-supplier label
 * (merchant alias > raw trace supplier > description).
 */
export async function getFinanceState(): Promise<FinanceState> {
  const [transactions, monthly, costHeads, departmentRows, managementCostHeadRows, legacyMappings, providers] =
    await Promise.all([
      prisma.financeTransaction.findMany({
        orderBy: [{ month: "asc" }, { paymentDate: "asc" }, { id: "asc" }],
        include: {
          allocation: true,
          paymentTrace: true,
          disputedCharge: true,
          paymentCostSplit: true,
          overheadOverride: true,
        },
      }),
      prisma.financeMonthly.findMany({ orderBy: { month: "asc" } }),
      prisma.financeCostHead.findMany({ orderBy: [{ head: "asc" }, { centre: "asc" }] }),
      prisma.financeManagementDepartment.findMany({ orderBy: { name: "asc" } }),
      prisma.financeManagementCostHead.findMany({ orderBy: { name: "asc" } }),
      prisma.financeLegacyMapping.findMany(),
      prisma.financeMerchantProvider.findMany({ include: { aliases: true } }),
    ]);

  const mappingByKey = new Map(
    legacyMappings.map((m) => [`${m.legacyHead}\u0000${m.legacyCentre}`, m])
  );

  // alias (casefolded) -> approved provider name, for reportingSupplier
  // resolution — a pure reporting label, never rewrites the original
  // description (see docs/SUPPLIER_NAME_MATCHING.md in the source app).
  const aliasToProvider = new Map<string, string>();
  for (const p of providers) {
    for (const a of p.aliases) {
      aliasToProvider.set(a.alias.trim().toLowerCase(), p.name);
    }
  }

  const rows: FinanceLedgerRow[] = transactions.map((t) => {
    const a = t.allocation;
    const trace = t.paymentTrace;
    const assignedHead = a?.head ?? null;
    const assignedCentre = a?.centre ?? null;
    const effectiveHead = assignedHead || t.originalHead;
    const effectiveCentre = assignedCentre || t.originalCentre;

    const hasManagementOverride = Boolean(a?.department && a?.costHead);
    const mapping =
      mappingByKey.get(`${effectiveHead ?? ""}\u0000${effectiveCentre ?? ""}`) ??
      mappingByKey.get(`${t.originalHead ?? ""}\u0000${t.originalCentre ?? ""}`);

    const descriptionKey = (t.description || "").trim().toLowerCase();
    const traceSupplierKey = (trace?.supplier || "").trim().toLowerCase();
    const reportingSupplier =
      aliasToProvider.get(descriptionKey) ??
      aliasToProvider.get(traceSupplierKey) ??
      trace?.supplier ??
      t.description;
    const supplierNameApproved = aliasToProvider.has(descriptionKey) || aliasToProvider.has(traceSupplierKey);

    return {
      id: t.id,
      month: t.month,
      date: t.paymentDate,
      description: t.description,
      costCentre: t.originalCentre,
      head: t.originalHead,
      assignedCentre,
      assignedHead,
      effectiveHead,
      effectiveCentre,
      amount: t.amountUsd,
      debtPeriod: a?.debtPeriod ?? "current",
      reviewed: a?.reviewed ?? false,
      reviewGroup: t.reviewGroup,
      note: a?.note ?? null,
      managementDepartment: a?.department ?? mapping?.department ?? null,
      managementCostHead: a?.costHead ?? mapping?.costHead ?? null,
      managementSource: hasManagementOverride ? "payment" : mapping?.source ?? "pending",
      hasManagementOverride,
      paymentReference: trace?.paymentReference ?? "",
      erpPaymentId: trace?.erpPaymentId ?? "",
      invoiceReference: trace?.erpInvoiceId ?? "",
      traceSupplier: trace?.supplier ?? "",
      tracePurpose: trace?.purpose ?? "",
      paymentMethod: trace?.paymentMethod ?? "Unknown",
      paymentSourceId: trace?.paymentSourceId ?? "",
      subscriptionId: trace?.subscriptionId ?? "",
      sourceCurrency: trace?.sourceCurrency ?? "",
      sourceAmount: trace?.sourceAmount ?? null,
      traceReviewed: trace?.reviewed ?? false,
      reportingSupplier,
      supplierNameApproved,
      dispute: t.disputedCharge
        ? {
            status: t.disputedCharge.status,
            reason: t.disputedCharge.reason,
            financeOwner: t.disputedCharge.financeOwner,
          }
        : null,
      departmentSplits: t.paymentCostSplit ? JSON.parse(t.paymentCostSplit.breakdownJson) : [],
      splitApprovedAt: t.paymentCostSplit?.approvedAt?.toISOString() ?? null,
      overheadOverride: t.overheadOverride
        ? { costNature: t.overheadOverride.costNature, costBehaviour: t.overheadOverride.costBehaviour }
        : null,
      sourceSheet: t.sourceSheet,
      sourceRow: t.sourceRow,
      sourceFile: t.sourceFile,
    };
  });

  return {
    transactions: rows,
    monthly,
    costHeads,
    departments: departmentRows.map((d) => d.name),
    managementCostHeads: managementCostHeadRows.map((h) => h.name),
    legacyMappings,
    classifications: await prisma.financeAllocation.count(),
  };
}

/** Direct port of the source's valid_category(). */
export async function validCategory(department: string, costHead: string): Promise<string | null> {
  if (Boolean(department) !== Boolean(costHead)) return "Choose both a department and a cost head.";
  if (department) {
    const exists = await prisma.financeManagementDepartment.findFirst({ where: { name: department } });
    if (!exists) return "Select a department from Manage Departments.";
  }
  if (costHead) {
    const exists = await prisma.financeManagementCostHead.findFirst({ where: { name: costHead } });
    if (!exists) return "Choose an existing cost head, or create one first.";
  }
  return null;
}

export type ClassifyResult = { ok: true; changeId: string } | { ok: false; status: number; error: string };

/**
 * Sets a payment's cost-head/centre override, historical-debt bucket, and
 * management department/cost-head — direct port of the source's
 * classify(). Hard invariant preserved: a payment with an approved
 * shared-cost split cannot be reclassified until the split is undone
 * (checked via FinancePaymentCostSplit, same mutual exclusion the source
 * enforces against subscription_split_preview/apply).
 */
export async function classifyTransaction(params: {
  transactionId: string;
  head?: string;
  centre?: string;
  debtPeriod?: string;
  department?: string;
  costHead?: string;
  note?: string;
  reviewed?: boolean;
  actorId: string;
  actorEmail: string;
}): Promise<ClassifyResult> {
  const { transactionId } = params;
  const tx = await prisma.financeTransaction.findUnique({ where: { id: transactionId } });
  if (!tx) return { ok: false, status: 404, error: "Payment not found" };

  const existingSplit = await prisma.financePaymentCostSplit.findUnique({ where: { transactionId } });
  if (existingSplit) {
    return {
      ok: false,
      status: 409,
      error:
        "This payment has an approved department split. Undo the split in Change History before changing its classification.",
    };
  }

  const head = (params.head ?? "").trim();
  const centre = (params.centre ?? "").trim();
  if (Boolean(head) !== Boolean(centre)) {
    return { ok: false, status: 400, error: "Choose a complete existing cost-head pair" };
  }
  if (head) {
    const pairExists = await prisma.financeCostHead.findFirst({ where: { head, centre } });
    if (!pairExists) {
      return { ok: false, status: 400, error: "Cost head must be selected from existing One Homes cost heads" };
    }
  }
  const debtPeriod = params.debtPeriod ?? "current";
  if (!["current", "2024-25", "older"].includes(debtPeriod)) {
    return { ok: false, status: 400, error: "Invalid historical debt classification" };
  }
  const department = params.department ?? "";
  const costHead = params.costHead ?? "";
  const categoryError = await validCategory(department, costHead);
  if (categoryError) return { ok: false, status: 400, error: categoryError };

  const before = await revisionItems("FinanceAllocation", [transactionId]);

  await prisma.financeAllocation.upsert({
    where: { transactionId },
    create: {
      transactionId,
      head: head || null,
      centre: centre || null,
      department: department || null,
      costHead: costHead || null,
      debtPeriod,
      reviewed: Boolean(params.reviewed),
      note: params.note ? params.note.slice(0, 3000) : null,
    },
    update: {
      head: head || null,
      centre: centre || null,
      department: department || null,
      costHead: costHead || null,
      debtPeriod,
      reviewed: Boolean(params.reviewed),
      note: params.note ? params.note.slice(0, 3000) : null,
    },
  });

  const after = await revisionItems("FinanceAllocation", [transactionId]);
  const changeId = await logReversible({
    organizationId: tx.organizationId,
    action: "classify",
    description: `Payment classification · ${transactionId}`,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    before,
    after,
  });

  return { ok: true, changeId };
}

export type BulkClassifyResult =
  | { ok: true; updated: number; changeId: string }
  | { ok: false; status: number; error: string };

/** Direct port of bulk_management_classify() — tags up to 5,000 payments at once. */
export async function bulkClassifyTransactions(params: {
  ids: string[];
  department: string;
  costHead: string;
  note?: string;
  actorId: string;
  actorEmail: string;
}): Promise<BulkClassifyResult> {
  const { ids } = params;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 5000 || new Set(ids).size !== ids.length) {
    return { ok: false, status: 400, error: "Select 1 to 5,000 different payment records." };
  }

  const categoryError = await validCategory(params.department, params.costHead);
  if (categoryError) return { ok: false, status: 400, error: categoryError };

  const found = await prisma.financeTransaction.findMany({
    where: { id: { in: ids } },
    select: { id: true, organizationId: true },
  });
  if (found.length !== ids.length) {
    return { ok: false, status: 400, error: "Some selected payments no longer exist. Refresh the page." };
  }

  const splitCount = await prisma.financePaymentCostSplit.count({ where: { transactionId: { in: ids } } });
  if (splitCount > 0) {
    return {
      ok: false,
      status: 409,
      error: `${splitCount} selected payments have an approved shared-cost allocation. Undo those splits before reclassifying entire payments.`,
    };
  }

  const before = await revisionItems("FinanceAllocation", ids);
  const note = (params.note ?? "").trim().slice(0, 1000);

  for (const id of ids) {
    const existing = await prisma.financeAllocation.findUnique({ where: { transactionId: id } });
    await prisma.financeAllocation.upsert({
      where: { transactionId: id },
      create: {
        transactionId: id,
        department: params.department || null,
        costHead: params.costHead || null,
        debtPeriod: "current",
        reviewed: false,
        note: note || null,
      },
      update: {
        department: params.department || null,
        costHead: params.costHead || null,
        // Appends rather than overwrites, matching the source's
        // `note || char(10) || excluded.note` behaviour.
        note: note ? [existing?.note, note].filter(Boolean).join("\n") : existing?.note ?? null,
      },
    });
  }

  const after = await revisionItems("FinanceAllocation", ids);
  const changeId = await logReversible({
    organizationId: found[0]?.organizationId ?? null,
    action: "bulk_management_classify",
    description: `${ids.length} payments → ${params.department} / ${params.costHead}`,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    before,
    after,
  });

  return { ok: true, updated: ids.length, changeId };
}

export type DisputeResult = { ok: true; status: string; changeId: string } | { ok: false; status: number; error: string };

/** Direct port of mark_disputed(). */
export async function markDisputed(params: {
  transactionId: string;
  status: "Open" | "Under review" | "Resolved";
  reason: string;
  financeOwner?: string;
  notes?: string;
  resolution?: string;
  actorId: string;
  actorEmail: string;
}): Promise<DisputeResult> {
  const reason = params.reason.trim().slice(0, 1500);
  if (!["Open", "Under review", "Resolved"].includes(params.status)) {
    return { ok: false, status: 400, error: "Unknown dispute status" };
  }
  if (!reason) return { ok: false, status: 400, error: "Explain why the payment is disputed." };
  const resolution = (params.resolution ?? "").trim().slice(0, 3000);
  if (params.status === "Resolved" && !resolution) {
    return { ok: false, status: 400, error: "Record the Finance investigation outcome before resolving." };
  }

  const tx = await prisma.financeTransaction.findUnique({ where: { id: params.transactionId } });
  if (!tx) return { ok: false, status: 404, error: "Payment not found" };

  const before = await revisionItems("FinanceDisputedCharge", [params.transactionId]);
  const existing = before[0].row as { openedAt?: string } | null;

  await prisma.financeDisputedCharge.upsert({
    where: { transactionId: params.transactionId },
    create: {
      transactionId: params.transactionId,
      status: params.status,
      reason,
      financeOwner: (params.financeOwner ?? "").trim().slice(0, 200) || null,
      notes: (params.notes ?? "").trim().slice(0, 3000) || null,
      resolution: resolution || null,
      resolvedAt: params.status === "Resolved" ? new Date() : null,
    },
    update: {
      status: params.status,
      reason,
      financeOwner: (params.financeOwner ?? "").trim().slice(0, 200) || null,
      notes: (params.notes ?? "").trim().slice(0, 3000) || null,
      resolution: resolution || null,
      resolvedAt: params.status === "Resolved" ? new Date() : null,
    },
  });

  const after = await revisionItems("FinanceDisputedCharge", [params.transactionId]);
  const changeId = await logReversible({
    organizationId: tx.organizationId,
    action: "dispute_review",
    description: `Dispute ${params.status.toLowerCase()} · ${params.transactionId}`,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    before,
    after,
  });

  return { ok: true, status: params.status, changeId };
}

// --- Taxonomy administration ------------------------------------------

const NAME_PATTERN = /^[\w &/(),.+-]+$/u;

export async function createDepartment(name: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed.length < 2 || trimmed.length > 70 || !NAME_PATTERN.test(trimmed)) {
    return { ok: false, error: "Department must be 2 to 70 characters, with a plain-text name." };
  }
  const existing = await prisma.financeManagementDepartment.findFirst({
    where: { name: { equals: trimmed } },
  });
  if (existing) return { ok: false, error: "That department already exists." };
  await prisma.financeManagementDepartment.create({ data: { name: trimmed } });
  return { ok: true };
}

export async function createCostHead(name: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed.length < 2 || trimmed.length > 80 || !NAME_PATTERN.test(trimmed)) {
    return { ok: false, error: "Cost head must be 2 to 80 characters and use plain text." };
  }
  const existing = await prisma.financeManagementCostHead.findFirst({ where: { name: { equals: trimmed } } });
  if (existing) return { ok: false, error: "That cost head already exists." };
  await prisma.financeManagementCostHead.create({ data: { name: trimmed } });
  return { ok: true };
}

export async function updateMonth(params: {
  month: string;
  collections?: number;
  collectionsPlan?: number;
  salesPlan?: number;
  opexBudget?: number;
}): Promise<void> {
  // FinanceMonthly's real unique key is the compound (organizationId,
  // month) — organizationId isn't known here (it's injected by the
  // tenant-scoping extension only once the query actually runs), so a
  // plain `upsert` can't name that compound key directly. findFirst +
  // create/update instead; both are still correctly tenant-scoped by the
  // same extension.
  const existing = await prisma.financeMonthly.findFirst({ where: { month: params.month } });
  if (existing) {
    await prisma.financeMonthly.update({
      where: { id: existing.id },
      data: {
        ...(params.collections !== undefined ? { collections: params.collections } : {}),
        ...(params.collectionsPlan !== undefined ? { collectionsPlan: params.collectionsPlan } : {}),
        ...(params.salesPlan !== undefined ? { salesPlan: params.salesPlan } : {}),
        ...(params.opexBudget !== undefined ? { opexBudget: params.opexBudget } : {}),
      },
    });
  } else {
    await prisma.financeMonthly.create({
      data: {
        month: params.month,
        collections: params.collections ?? 0,
        collectionsPlan: params.collectionsPlan ?? 0,
        salesPlan: params.salesPlan ?? 0,
        opexBudget: params.opexBudget ?? 0,
      },
    });
  }
}

// --- Ledger import history ----------------------------------------------
// FinanceImport tracks each committed "Upload New Months" ledger import
// (filename, added/skipped/invalid counts, added USD). Nothing writes to
// this table yet — POST /api/finance/ledger/import/commit is still a
// deliberate 501 stub (no XLSX-parsing backend exists). These two readers
// are wired for real so the Upload New Months screen's "Recent import
// history" table reflects actual rows the moment that backend lands,
// rather than a hardcoded empty array.

export async function listRecentFinanceImports(limit = 20) {
  return prisma.financeImport.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}

export async function countFinanceImports(): Promise<number> {
  return prisma.financeImport.count();
}
