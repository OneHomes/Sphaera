import Database from "better-sqlite3";
import { prisma } from "../lib/prisma";

// One-off migration for the Sphaera Finance module (Stage 2 of the port
// plan) — reads the real production data out of the standalone Python
// app's SQLite database (app/onehomes.sqlite, extracted read-only from
// Sphaera_Finance_Mac_v42.zip) and loads it into the new Finance* Prisma
// tables, scoped to the One Homes organization. Only the 6 tables that
// actually hold real rows get migrated here (~5,400 rows total) — every
// other Finance table is schema-ready but genuinely empty in the source,
// so there's nothing to migrate for them. Idempotent: every write is an
// upsert keyed on the same natural/composite key the source used, so
// re-running this script after a partial run or a source refresh is safe.

const SQLITE_PATH =
  "C:\\Users\\OwaisShaikh\\Downloads\\sphaera-finance-extract\\Sphaera_Finance_Mac_v42\\app\\onehomes.sqlite";
const ONE_HOMES_SLUG = "one-homes";

type SqliteRow = Record<string, string | number | null>;

function toDate(value: string | number | null): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toBool(value: string | number | null): boolean {
  return value === 1 || value === "1";
}

async function main() {
  const org = await prisma.organization.findUniqueOrThrow({ where: { slug: ONE_HOMES_SLUG } });
  const organizationId = org.id;
  console.log(`Migrating into organization "${org.name}" (${organizationId})`);

  const db = new Database(SQLITE_PATH, { readonly: true, fileMustExist: true });

  // --- management_departments ---------------------------------------
  const departments = db.prepare("SELECT * FROM management_departments").all() as SqliteRow[];
  for (const row of departments) {
    await prisma.financeManagementDepartment.upsert({
      where: { organizationId_name: { organizationId, name: String(row.name) } },
      create: {
        organizationId,
        name: String(row.name),
        createdAt: toDate(row.created_at) ?? new Date(),
      },
      update: {},
    });
  }
  console.log(`management_departments: ${departments.length} rows`);

  // --- management_cost_heads ------------------------------------------
  const costHeadNames = db.prepare("SELECT * FROM management_cost_heads").all() as SqliteRow[];
  for (const row of costHeadNames) {
    await prisma.financeManagementCostHead.upsert({
      where: { organizationId_name: { organizationId, name: String(row.name) } },
      create: {
        organizationId,
        name: String(row.name),
        createdAt: toDate(row.created_at) ?? new Date(),
      },
      update: {},
    });
  }
  console.log(`management_cost_heads: ${costHeadNames.length} rows`);

  // --- cost_heads (legacy raw head/centre pairs) -----------------------
  const legacyCostHeads = db.prepare("SELECT * FROM cost_heads").all() as SqliteRow[];
  for (const row of legacyCostHeads) {
    await prisma.financeCostHead.upsert({
      where: {
        organizationId_head_centre: {
          organizationId,
          head: String(row.head),
          centre: String(row.centre),
        },
      },
      create: { organizationId, head: String(row.head), centre: String(row.centre) },
      update: {},
    });
  }
  console.log(`cost_heads: ${legacyCostHeads.length} rows`);

  // --- legacy_mappings --------------------------------------------------
  const legacyMappings = db.prepare("SELECT * FROM legacy_mappings").all() as SqliteRow[];
  for (const row of legacyMappings) {
    await prisma.financeLegacyMapping.upsert({
      where: {
        organizationId_legacyHead_legacyCentre: {
          organizationId,
          legacyHead: String(row.legacy_head),
          legacyCentre: String(row.legacy_centre),
        },
      },
      create: {
        organizationId,
        legacyHead: String(row.legacy_head),
        legacyCentre: String(row.legacy_centre),
        department: row.department ? String(row.department) : null,
        costHead: row.cost_head ? String(row.cost_head) : null,
        source: row.source ? String(row.source) : "suggested",
        updatedAt: toDate(row.updated_at) ?? new Date(),
      },
      update: {
        department: row.department ? String(row.department) : null,
        costHead: row.cost_head ? String(row.cost_head) : null,
        source: row.source ? String(row.source) : "suggested",
      },
    });
  }
  console.log(`legacy_mappings: ${legacyMappings.length} rows`);

  // --- monthly ------------------------------------------------------------
  const monthly = db.prepare("SELECT * FROM monthly").all() as SqliteRow[];
  for (const row of monthly) {
    await prisma.financeMonthly.upsert({
      where: { organizationId_month: { organizationId, month: String(row.month) } },
      create: {
        organizationId,
        month: String(row.month),
        collections: Number(row.collections ?? 0),
        collectionsPrior: Number(row.collections_prior ?? 0),
        collectionsPlan: Number(row.collections_plan ?? 0),
        salesPlan: Number(row.sales_plan ?? 0),
        opexBudget: Number(row.opex_budget ?? 0),
        updatedAt: toDate(row.updated_at) ?? new Date(),
      },
      update: {
        collections: Number(row.collections ?? 0),
        collectionsPrior: Number(row.collections_prior ?? 0),
        collectionsPlan: Number(row.collections_plan ?? 0),
        salesPlan: Number(row.sales_plan ?? 0),
        opexBudget: Number(row.opex_budget ?? 0),
      },
    });
  }
  console.log(`monthly: ${monthly.length} rows`);

  // --- transactions (the core ledger — must land before allocations) ----
  // Bulk createMany in batches instead of one upsert per row — sequential
  // per-row round trips to Azure SQL exhausted the connection pool well
  // before finishing 3,717 rows. Idempotent via an existing-id filter
  // (computed once) rather than per-row upsert, since SQL Server's Prisma
  // provider doesn't support createMany's skipDuplicates option.
  const transactions = db.prepare("SELECT * FROM transactions").all() as SqliteRow[];
  const existingTxIds = new Set(
    (await prisma.financeTransaction.findMany({ where: { organizationId }, select: { id: true } })).map(
      (t) => t.id
    )
  );
  const newTransactions = transactions.filter((row) => !existingTxIds.has(String(row.id)));
  const BATCH_SIZE = 500;
  for (let i = 0; i < newTransactions.length; i += BATCH_SIZE) {
    const batch = newTransactions.slice(i, i + BATCH_SIZE).map((row) => ({
      id: String(row.id),
      organizationId,
      fingerprint: String(row.fingerprint),
      occurrence: Number(row.occurrence ?? 0),
      month: String(row.month),
      paymentDate: toDate(row.payment_date) ?? new Date(),
      description: String(row.description ?? ""),
      originalCentre: row.original_centre ? String(row.original_centre) : null,
      originalHead: row.original_head ? String(row.original_head) : null,
      country: row.country ? String(row.country) : null,
      amountUsd: Number(row.amount_usd ?? 0),
      sourceSheet: row.source_sheet ? String(row.source_sheet) : null,
      sourceRow: row.source_row !== null ? Number(row.source_row) : null,
      sourceFile: row.source_file ? String(row.source_file) : null,
      reviewGroup: row.review_group ? String(row.review_group) : "Routine",
      importedAt: toDate(row.imported_at) ?? new Date(),
    }));
    await prisma.financeTransaction.createMany({ data: batch });
    console.log(`  transactions batch ${i / BATCH_SIZE + 1}: +${batch.length}`);
  }
  console.log(`transactions: ${transactions.length} total (${newTransactions.length} newly inserted)`);

  // --- allocations (1:1 overlay on transactions) -------------------------
  const allocations = db.prepare("SELECT * FROM allocations").all() as SqliteRow[];
  const allTxIds = new Set(
    (await prisma.financeTransaction.findMany({ where: { organizationId }, select: { id: true } })).map(
      (t) => t.id
    )
  );
  const existingAllocTxIds = new Set(
    (await prisma.financeAllocation.findMany({ where: { organizationId }, select: { transactionId: true } })).map(
      (a) => a.transactionId
    )
  );
  let skippedAllocations = 0;
  const newAllocations = allocations.filter((row) => {
    const transactionId = String(row.transaction_id);
    if (!allTxIds.has(transactionId)) {
      skippedAllocations++;
      return false;
    }
    return !existingAllocTxIds.has(transactionId);
  });
  for (let i = 0; i < newAllocations.length; i += BATCH_SIZE) {
    const batch = newAllocations.slice(i, i + BATCH_SIZE).map((row) => ({
      organizationId,
      transactionId: String(row.transaction_id),
      head: row.head ? String(row.head) : null,
      centre: row.centre ? String(row.centre) : null,
      department: row.department ? String(row.department) : null,
      costHead: row.cost_head ? String(row.cost_head) : null,
      debtPeriod: row.debt_period ? String(row.debt_period) : "current",
      reviewed: toBool(row.reviewed),
      note: row.note ? String(row.note) : null,
      updatedAt: toDate(row.updated_at) ?? new Date(),
    }));
    await prisma.financeAllocation.createMany({ data: batch });
    console.log(`  allocations batch ${i / BATCH_SIZE + 1}: +${batch.length}`);
  }
  console.log(
    `allocations: ${allocations.length - skippedAllocations} total matched (${newAllocations.length} newly inserted, ${skippedAllocations} skipped — no matching transaction)`
  );

  db.close();
  console.log("Migration complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
