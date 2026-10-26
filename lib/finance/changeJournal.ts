import { prisma } from "../prisma";

// Generic reversible-change log, ported from the source Python app's
// `log_reversible`/`undo_change`/`change_history` (server.py). Distinct
// from the app-wide AuditLog (a flat append-only record) — this stores
// full before/after row snapshots for a whitelisted set of tables so a
// change can be undone later, with an optimistic-concurrency check (the
// record must still match its stored "after" snapshot, or undo is
// refused — "a newer change affected this record").

export type RevisionItem = { table: RevertibleTable; id: string; row: Record<string, unknown> | null };

// Maps each revertible table to (a) its row's natural key field name and
// (b) a snapshot/restore pair. Mirrors the source's REVERTIBLE_TABLES
// dict exactly (allocations, disputed_charges, monthly, payment_cost_splits,
// overhead_head_rules, overhead_payment_overrides, person_cost_allocations,
// merchant_aliases) — Finance* Prisma model names here, not SQLite table names.
export const REVERTIBLE_TABLES = {
  FinanceAllocation: "transactionId",
  FinanceDisputedCharge: "transactionId",
  FinanceMonthly: "month",
  FinancePaymentCostSplit: "transactionId",
  FinanceOverheadHeadRule: "costHead",
  FinanceOverheadPaymentOverride: "transactionId",
  FinancePersonCostAllocation: "id",
  FinanceMerchantAlias: "alias",
} as const;

export type RevertibleTable = keyof typeof REVERTIBLE_TABLES;

// Prisma doesn't support `prisma[modelName]` with a dynamic string name
// cleanly in a type-safe way across our model set, so this is the one
// explicit dispatch table every function below routes through.
function delegateFor(table: RevertibleTable) {
  switch (table) {
    case "FinanceAllocation":
      return prisma.financeAllocation;
    case "FinanceDisputedCharge":
      return prisma.financeDisputedCharge;
    case "FinanceMonthly":
      return prisma.financeMonthly;
    case "FinancePaymentCostSplit":
      return prisma.financePaymentCostSplit;
    case "FinanceOverheadHeadRule":
      return prisma.financeOverheadHeadRule;
    case "FinanceOverheadPaymentOverride":
      return prisma.financeOverheadPaymentOverride;
    case "FinancePersonCostAllocation":
      return prisma.financePersonCostAllocation;
    case "FinanceMerchantAlias":
      return prisma.financeMerchantAlias;
  }
}

// Tables whose natural key here is only unique in combination with
// organizationId (a compound @@unique, not a standalone @unique field) —
// findUnique can't take a bare { [keyField]: id } selector for these, so
// they go through findFirst instead (still correctly tenant-scoped by
// the Prisma extension either way).
const COMPOUND_KEY_TABLES = new Set<RevertibleTable>(["FinanceMonthly", "FinanceOverheadHeadRule", "FinanceMerchantAlias"]);

async function revisionRecord(table: RevertibleTable, id: string): Promise<Record<string, unknown> | null> {
  const keyField = REVERTIBLE_TABLES[table];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = delegateFor(table) as any;
  const row = COMPOUND_KEY_TABLES.has(table)
    ? await delegate.findFirst({ where: { [keyField]: id } })
    : await delegate.findUnique({ where: { [keyField]: id } });
  return row ? JSON.parse(JSON.stringify(row)) : null;
}

export async function revisionItems(table: RevertibleTable, ids: string[]): Promise<RevisionItem[]> {
  return Promise.all(ids.map(async (id) => ({ table, id, row: await revisionRecord(table, id) })));
}

/** Writes one undoable entry. Call this immediately after the real mutation lands. */
export async function logReversible(params: {
  organizationId: string | null;
  auditId?: string | null;
  action: string;
  description: string;
  actorId: string;
  actorEmail: string;
  before: RevisionItem[];
  after: RevisionItem[];
}): Promise<string> {
  const entry = await prisma.financeChangeJournal.create({
    data: {
      organizationId: params.organizationId,
      auditId: params.auditId ?? null,
      action: params.action,
      description: params.description,
      actorId: params.actorId,
      actorEmail: params.actorEmail,
      beforeJson: JSON.stringify(params.before),
      afterJson: JSON.stringify(params.after),
    },
  });
  return entry.id;
}

export async function getChangeHistory() {
  const changes = await prisma.financeChangeJournal.findMany({
    orderBy: { changedAt: "desc" },
    take: 350,
  });
  return changes;
}

export type UndoResult =
  | { ok: true; undone: string; restoredRecords: number }
  | { ok: false; status: number; error: string };

/**
 * Restores a FinanceChangeJournal entry's "before" snapshot, refusing if
 * the record has changed since (optimistic concurrency — "Undo blocked: a
 * newer change affected this record"), exactly matching the source's
 * undo_change(). actorId/actorEmail identify who performed the undo.
 */
export async function undoChange(
  journalId: string,
  actorId: string,
  actorEmail: string
): Promise<UndoResult> {
  const entry = await prisma.financeChangeJournal.findUnique({ where: { id: journalId } });
  if (!entry) return { ok: false, status: 404, error: "History entry not found." };
  if (entry.undoneAt) return { ok: false, status: 409, error: "This change was already undone." };

  const before = JSON.parse(entry.beforeJson) as RevisionItem[];
  const after = JSON.parse(entry.afterJson) as RevisionItem[];
  if (before.length !== after.length || before.length > 5000) {
    return { ok: false, status: 400, error: "Invalid history snapshot" };
  }

  for (let i = 0; i < before.length; i++) {
    const b = before[i];
    const a = after[i];
    if (!(b.table in REVERTIBLE_TABLES) || b.table !== a.table || b.id !== a.id) {
      return { ok: false, status: 400, error: "Automatic undo is not permitted for this operation." };
    }
    const current = await revisionRecord(a.table, a.id);
    if (JSON.stringify(current) !== JSON.stringify(a.row)) {
      return {
        ok: false,
        status: 409,
        error: "Undo blocked: a newer change affected this record. Review the latest history first.",
      };
    }
  }

  for (const item of before) {
    const keyField = REVERTIBLE_TABLES[item.table];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = delegateFor(item.table) as any;
    if (item.table === "FinanceMonthly") {
      await delegate.deleteMany({ where: { [keyField]: item.id } });
    } else {
      await delegate.deleteMany({ where: { [keyField]: item.id } });
    }
    if (item.row) {
      const { id: _ignoredId, ...rest } = item.row as Record<string, unknown>;
      await delegate.create({ data: item.table === "FinancePersonCostAllocation" ? item.row : rest });
    }
  }

  await prisma.financeChangeJournal.update({
    where: { id: journalId },
    data: { undoneAt: new Date(), undoneBy: actorEmail },
  });

  return { ok: true, undone: journalId, restoredRecords: before.length };
}
