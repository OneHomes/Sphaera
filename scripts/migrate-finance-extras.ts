import Database from "better-sqlite3";
import { prisma } from "../lib/prisma";

// Follow-up to migrate-finance-data.ts: source tables that gained rows after the first
// migration (disputes, payment traces, ERP source registry, import history). Idempotent upserts.

const SQLITE_PATH =
  "C:\\Users\\OwaisShaikh\\Downloads\\sphaera-finance-extract\\Sphaera_Finance_Mac_v42\\app\\onehomes.sqlite";

type Row = Record<string, string | number | null>;
const str = (v: string | number | null | undefined) => (v === null || v === undefined || v === "" ? null : String(v));
const date = (v: string | number | null) => {
  if (v === null || v === "") return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

async function main() {
  const org = await prisma.organization.findUniqueOrThrow({ where: { slug: "one-homes" } });
  const organizationId = org.id;
  const db = new Database(SQLITE_PATH, { readonly: true, fileMustExist: true });

  for (const r of db.prepare("SELECT * FROM erp_sources").all() as Row[]) {
    const data = {
      organizationId,
      name: String(r.name),
      department: str(r.department),
      legalEntity: str(r.legal_entity),
      environment: str(r.environment),
      integrationMode: str(r.integration_mode),
      endpointUrl: str(r.endpoint_url),
      region: str(r.region),
      active: r.active === 1,
    };
    await prisma.financeErpSource.upsert({
      where: { id: String(r.id) },
      create: { id: String(r.id), ...data, createdAt: date(r.created_at) ?? new Date() },
      update: data,
    });
  }
  console.log("erp_sources done");

  const txIds = new Set((await prisma.financeTransaction.findMany({ select: { id: true } })).map((t) => t.id));
  const sourceIds = new Set((await prisma.financePaymentSource.findMany({ select: { id: true } })).map((s) => s.id));
  const subIds = new Set((await prisma.financeSubscription.findMany({ select: { id: true } })).map((s) => s.id));

  let traces = 0;
  for (const r of db.prepare("SELECT * FROM payment_trace").all() as Row[]) {
    const transactionId = String(r.transaction_id);
    if (!txIds.has(transactionId)) continue;
    const data = {
      organizationId,
      paymentReference: str(r.payment_reference),
      erpPaymentId: str(r.erp_payment_id),
      erpInvoiceId: str(r.erp_invoice_id),
      erpSourceId: str(r.erp_source_id),
      supplier: str(r.supplier),
      purpose: str(r.purpose),
      paymentMethod: str(r.payment_method),
      paymentSourceId: r.payment_source_id && sourceIds.has(String(r.payment_source_id)) ? String(r.payment_source_id) : null,
      subscriptionId: r.subscription_id && subIds.has(String(r.subscription_id)) ? String(r.subscription_id) : null,
      sourceCurrency: str(r.source_currency),
      sourceAmount: r.source_amount === null || r.source_amount === "" ? null : Number(r.source_amount),
      reviewed: r.reviewed === 1,
    };
    await prisma.financePaymentTrace.upsert({ where: { transactionId }, create: { transactionId, ...data }, update: data });
    traces++;
  }
  console.log(`payment_trace: ${traces}`);

  let disputes = 0;
  for (const r of db.prepare("SELECT * FROM disputed_charges").all() as Row[]) {
    const transactionId = String(r.transaction_id);
    if (!txIds.has(transactionId)) continue;
    const data = {
      organizationId,
      status: String(r.status ?? "Open"),
      reason: str(r.reason),
      financeOwner: str(r.finance_owner),
      notes: str(r.notes),
      resolution: str(r.resolution),
      resolvedAt: date(r.resolved_at),
    };
    await prisma.financeDisputedCharge.upsert({
      where: { transactionId },
      create: { transactionId, ...data, openedAt: date(r.opened_at) ?? new Date() },
      update: data,
    });
    disputes++;
  }
  console.log(`disputed_charges: ${disputes}`);

  for (const r of db.prepare("SELECT * FROM imports").all() as Row[]) {
    const data = {
      organizationId,
      filename: String(r.filename),
      addedCount: Number(r.added ?? 0),
      skippedCount: Number(r.skipped ?? 0),
      invalidCount: Number(r.invalid ?? 0),
      addedAmount: Number(r.added_amount ?? 0),
      detailsJson: str(r.details_json),
    };
    await prisma.financeImport.upsert({
      where: { id: String(r.id) },
      create: { id: String(r.id), ...data, createdAt: date(r.imported_at) ?? new Date() },
      update: data,
    });
  }
  console.log("imports done");

  // --- audit (flat trail) -> AuditLog, finance_ prefixed ---------------------
  const audit = db.prepare("SELECT * FROM audit").all() as Row[];
  for (const r of audit) {
    const id = `legacy-audit-${r.id}`;
    await prisma.auditLog.upsert({
      where: { id },
      create: {
        id,
        organizationId,
        actorId: "legacy-finance-app",
        actorEmail: "local",
        action: `finance_${r.action}`,
        targetId: str(r.transaction_id),
        details: `Imported from the original finance app audit (#${r.id})`,
        createdAt: date(r.changed_at) ?? new Date(),
      },
      update: {},
    });
  }
  console.log(`audit: ${audit.length}`);

  // --- change_journal -> FinanceChangeJournal ---------------------------------
  // Snapshots are rewritten into Prisma row shape. Where a record still matches the source
  // "after" state, the live row is stored so Undo works; otherwise Undo stays blocked, as in the source.
  type Spec = { model: "FinanceAllocation" | "FinanceMonthly" | "FinanceDisputedCharge"; key: string; map: (row: Record<string, unknown>) => Record<string, unknown> };
  const nz = (v: unknown) => (v === null || v === undefined || v === "" ? null : v);
  const num0 = (v: unknown) => (v === null || v === undefined || v === "" ? 0 : Number(v));
  const iso = (v: unknown) => (nz(v) === null ? null : new Date(String(v)).toISOString());
  const SPECS: Record<string, Spec> = {
    allocations: {
      model: "FinanceAllocation",
      key: "transaction_id",
      map: (x) => ({
        transactionId: x.transaction_id,
        head: nz(x.head),
        centre: nz(x.centre),
        department: nz(x.department),
        costHead: nz(x.cost_head),
        debtPeriod: x.debt_period ?? "current",
        reviewed: x.reviewed === 1 || x.reviewed === true,
        note: nz(x.note),
      }),
    },
    monthly: {
      model: "FinanceMonthly",
      key: "month",
      map: (x) => ({
        month: x.month,
        collections: num0(x.collections),
        collectionsPrior: num0(x.collections_prior),
        collectionsPlan: num0(x.collections_plan),
        salesPlan: num0(x.sales_plan),
        opexBudget: num0(x.opex_budget),
      }),
    },
    disputed_charges: {
      model: "FinanceDisputedCharge",
      key: "transaction_id",
      map: (x) => ({
        transactionId: x.transaction_id,
        status: x.status ?? "Open",
        reason: nz(x.reason),
        financeOwner: nz(x.finance_owner),
        notes: nz(x.notes),
        resolution: nz(x.resolution),
        openedAt: iso(x.opened_at),
        resolvedAt: iso(x.resolved_at),
      }),
    },
  };
  const current = async (spec: Spec, id: string) => {
    const keyField = spec.model === "FinanceMonthly" ? "month" : "transactionId";
    const row =
      spec.model === "FinanceAllocation"
        ? await prisma.financeAllocation.findUnique({ where: { transactionId: id } })
        : spec.model === "FinanceDisputedCharge"
          ? await prisma.financeDisputedCharge.findUnique({ where: { transactionId: id } })
          : await prisma.financeMonthly.findFirst({ where: { [keyField]: id } });
    return row ? (JSON.parse(JSON.stringify(row)) as Record<string, unknown>) : null;
  };
  const same = (live: Record<string, unknown> | null, mapped: Record<string, unknown> | null) => {
    if (!live || !mapped) return live === mapped;
    return Object.entries(mapped).every(([k, v]) => JSON.stringify(nz(live[k])) === JSON.stringify(nz(v)));
  };

  const journal = db.prepare("SELECT * FROM change_journal ORDER BY id").all() as Row[];
  let undoable = 0;
  for (const r of journal) {
    const before = JSON.parse(String(r.before_json)) as { table: string; id: string; row: Record<string, unknown> | null }[];
    const after = JSON.parse(String(r.after_json)) as { table: string; id: string; row: Record<string, unknown> | null }[];
    const outBefore: unknown[] = [];
    const outAfter: unknown[] = [];
    let allMatch = true;
    for (let i = 0; i < after.length; i++) {
      const spec = SPECS[after[i].table];
      const id = String(after[i].id);
      const mappedAfter = after[i].row ? { organizationId, ...spec.map(after[i].row!) } : null;
      const mappedBefore = before[i]?.row ? { organizationId, ...spec.map(before[i].row!) } : null;
      const live = await current(spec, id);
      if (same(live, mappedAfter)) {
        outAfter.push({ table: spec.model, id, row: live });
        outBefore.push({ table: spec.model, id, row: mappedBefore && live ? { ...live, ...mappedBefore } : mappedBefore });
      } else {
        allMatch = false;
        outAfter.push({ table: spec.model, id, row: mappedAfter });
        outBefore.push({ table: spec.model, id, row: mappedBefore });
      }
    }
    if (allMatch) undoable++;
    const id = `legacy-journal-${r.id}`;
    await prisma.financeChangeJournal.upsert({
      where: { id },
      create: {
        id,
        organizationId,
        action: String(r.action),
        description: String(r.description),
        actorId: "legacy-finance-app",
        actorEmail: String(r.actor ?? "local"),
        beforeJson: JSON.stringify(outBefore),
        afterJson: JSON.stringify(outAfter),
        changedAt: date(r.changed_at) ?? new Date(),
        undoneAt: date(r.undone_at),
        undoneBy: str(r.undone_by),
      },
      update: {},
    });
  }
  console.log(`change_journal: ${journal.length} (${undoable} still undoable)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
