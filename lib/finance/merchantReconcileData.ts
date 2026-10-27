import { prisma } from "../prisma";
import { logReversible, revisionItems } from "./changeJournal";

// Merchant reconciliation, supplier-name clustering and invoice evidence,
// ported from the source Python app's merchant_reconcile.py (726 lines).
// Three sub-features, all deliberately conservative / non-automatic per
// the source's own docstrings and docs/SUPPLIER_NAME_MATCHING.md:
//
//  1. An Excel round-trip review workflow: export a batch of raw ledger
//     payments to an editable XLSX (immutable cells locked), re-validate
//     every "should be immutable" field server-side on import — Excel's
//     cell protection is advisory only and trivially bypassable.
//  2. Supplier-name normalisation ("reporting supplier"): raw bank
//     descriptions are conservatively clustered by first-distinctive-
//     brand-word matching (NOT fuzzy matching). Nothing auto-applies —
//     Finance must explicitly approve a suggested cluster into an
//     approved FinanceMerchantProvider/FinanceMerchantAlias pair. This is
//     a pure reporting label; the original transaction description is
//     never rewritten.
//  3. Invoice evidence: best-effort text extraction (wired by a later
//     stage) feeds regex-based field suggestions and a suggested match to
//     a ledger payment by amount/supplier/date proximity. Nothing here
//     auto-links a payment either — see linkInvoiceToTransaction.
//
// Schema note: this port's Finance* merchant tables are considerably
// slimmer than the source's SQLite tables (no invoice_number, no
// purpose/notes/reviewer columns, no subscriptions linkage). Each place
// that forced an adaptation is called out in a comment at the point of
// difference — flagged again in the handback report.

function clamp(value: unknown, length = 500): string {
  const s = String(value ?? "").trim();
  return s.length > length ? s.slice(0, length) : s;
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function parseEmailList(value: string, maxEmails = 100): { emails: string[]; error: string | null } {
  const emails = value
    .split(/[;,\n]/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length > maxEmails || emails.some((e) => !EMAIL_PATTERN.test(e))) {
    return { emails: [], error: "Invalid subscription user email(s)" };
  }
  return { emails: Array.from(new Set(emails)), error: null };
}

// ---------------------------------------------------------------------
// 1. Review batches (export/commit lifecycle tracking)
// ---------------------------------------------------------------------

export type MerchantBatchStatus = "open" | "exported" | "committed";

/**
 * Creates a tracking record for a merchant/cost-head/FY review batch.
 * Direct port of the batch bookkeeping the source does in commit()
 * (merchant_batches), adapted to the port's slimmer FinanceMerchantBatch
 * model (merchant/costHead/fyStart/status, no filename/applied counters).
 *
 * Note: FinanceMerchantReview has no batchId column in this port's schema
 * (unlike the source's merchant_reviews.batch_id FK), so a batch record
 * here is a standalone lifecycle marker, not a parent of review rows.
 * Flagged for double-check against the source's lines 445-446.
 */
export async function createMerchantReviewBatch(params: {
  organizationId?: string | null;
  merchant?: string;
  costHead?: string;
  fyStart?: number;
}): Promise<{ id: string; status: MerchantBatchStatus }> {
  const batch = await prisma.financeMerchantBatch.create({
    data: {
      merchant: params.merchant ? clamp(params.merchant, 150) : null,
      costHead: params.costHead ? clamp(params.costHead, 160) : null,
      fyStart: params.fyStart ?? null,
      status: "open",
    },
  });
  return { id: batch.id, status: batch.status as MerchantBatchStatus };
}

export async function markMerchantBatchStatus(
  batchId: string,
  status: MerchantBatchStatus
): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = await prisma.financeMerchantBatch.findUnique({ where: { id: batchId } });
  if (!existing) return { ok: false, error: "Batch not found" };
  await prisma.financeMerchantBatch.update({ where: { id: batchId }, data: { status } });
  return { ok: true };
}

export async function listRecentMerchantBatches(limit = 25) {
  return prisma.financeMerchantBatch.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}

// ---------------------------------------------------------------------
// Fiscal-year / cost-head payment filtering helpers (shared by export and
// catalog scoping) — direct port of the source's filtered_head_rows() /
// selected_head_ids() date-window logic (merchant_reconcile.py:48-71).
// ---------------------------------------------------------------------

/** FY `2024` -> ['2024-11', '2025-10'], matching the source's Nov-Oct fiscal year. */
export function fiscalYearMonthWindow(fyStart?: number | null): { start: string; end: string } {
  if (fyStart == null) return { start: "0000-01", end: "9999-12" };
  if (!Number.isInteger(fyStart) || fyStart < 2000 || fyStart > 2099) {
    throw new Error("Invalid fiscal-year selection");
  }
  return { start: `${fyStart}-11`, end: `${fyStart + 1}-10` };
}

/**
 * Resolves each transaction's "effective cost head" the same way the
 * source's filtered_head_rows() does: per-payment allocation override,
 * else legacy mapping, else the original ERP cost centre, else
 * 'Needs allocation'. A lighter-weight read-only companion to
 * ledgerData.ts's full getFinanceState() mega-join, scoped to what batch
 * filtering needs.
 */
export async function effectiveCostHeadsForWindow(
  fyStart?: number | null
): Promise<Array<{ transactionId: string; description: string; supplier: string; effectiveHead: string }>> {
  const { start, end } = fiscalYearMonthWindow(fyStart ?? null);
  const [transactions, legacyMappings] = await Promise.all([
    prisma.financeTransaction.findMany({
      where: { month: { gte: start, lte: end } },
      include: { allocation: true, paymentTrace: true },
    }),
    prisma.financeLegacyMapping.findMany(),
  ]);
  const mappingByKey = new Map(legacyMappings.map((m) => [`${m.legacyHead}\u0000${m.legacyCentre}`, m]));
  return transactions.map((t) => {
    const a = t.allocation;
    const head = a?.head || t.originalHead || "";
    const centre = a?.centre || t.originalCentre || "";
    const mapping = mappingByKey.get(`${head}\u0000${centre}`);
    const effectiveHead = a?.costHead || mapping?.costHead || t.originalCentre || "Needs allocation";
    return {
      transactionId: t.id,
      description: t.description,
      supplier: t.paymentTrace?.supplier ?? "",
      effectiveHead,
    };
  });
}

// ---------------------------------------------------------------------
// 2. Supplier-name clustering ("reporting supplier" suggestions)
//    merchant_reconcile.py:86-157, docs/SUPPLIER_NAME_MATCHING.md
// ---------------------------------------------------------------------

// Common words/wrappers that are never a usable "distinctive brand word"
// on their own — direct port of GENERIC_MERCHANT_PREFIXES
// (merchant_reconcile.py:88-101). Keep this set exactly as-is: widening it
// is what keeps the clustering conservative.
export const GENERIC_MERCHANT_PREFIXES = new Set([
  "account", "bank", "card", "payment", "payments", "paid", "transfer", "transfers",
  "charge", "charges", "online", "domestic", "incoming", "outgoing", "wire", "bill",
  "bills", "invoice", "salary", "salaries", "commission", "fees", "fee", "cash",
  "credit", "debit", "direct", "deposit", "refund", "remittance", "tax",
  "standing", "monthly", "annual", "funds", "transaction", "supplier",
  "services", "service", "business", "one", "home", "housing", "pmt",
  "subscription", "international", "cost", "expense", "payroll", "purchase",
  "marketing", "development", "sales", "to", "for", "the", "of", "from",
  "syed", "muhammad", "mohammad", "ahmed", "hammad", "haider", "hassan",
  "abdul", "mohammed", "ali", "mr", "ms", "applepay", "aplpay", "paypal",
  "tst", "sumup", "sq", "sqsp", "sp", "pay", "shop", "mobile", "office",
  "refunds", "transferwise", "wise",
]);

function tokenize(value: string): string[] {
  return (String(value || "").toLowerCase().match(/[a-z0-9]+/g)) ?? [];
}

/**
 * Conservative first-token candidate, not legal-entity verification.
 * Direct port of _merchant_brand() (merchant_reconcile.py:103-108).
 */
export function merchantBrand(value: string): string {
  const words = tokenize(value);
  if (words.length === 0 || words[0].length < 4 || GENERIC_MERCHANT_PREFIXES.has(words[0])) return "";
  return words[0];
}

/**
 * Approved alias -> reporting provider name. Does not touch transactions
 * or payment trace. This is the canonical version of the small inline
 * map ledgerData.ts builds for its own reportingSupplier resolution
 * (lib/finance/ledgerData.ts getFinanceState) — other code should prefer
 * this one. Direct port of reporting_provider_map()
 * (merchant_reconcile.py:110-112).
 */
export async function getSupplierAliasMap(): Promise<Map<string, string>> {
  const providers = await prisma.financeMerchantProvider.findMany({ include: { aliases: true } });
  const map = new Map<string, string>();
  for (const p of providers) {
    for (const a of p.aliases) map.set(a.alias.trim().toLowerCase(), p.name);
  }
  return map;
}

/**
 * Resolves the reporting-supplier label for one transaction: approved
 * alias (by description, then by raw trace supplier) first, falling back
 * to the raw trace supplier, then the raw description. Pure reporting
 * label — never rewrites FinanceTransaction.description. Canonical
 * version other code should reuse (see getSupplierAliasMap doc above).
 */
export async function resolveReportingSupplier(
  transactionId: string
): Promise<{ label: string; approved: boolean } | null> {
  const tx = await prisma.financeTransaction.findUnique({
    where: { id: transactionId },
    include: { paymentTrace: true },
  });
  if (!tx) return null;
  const aliasMap = await getSupplierAliasMap();
  const descriptionKey = (tx.description || "").trim().toLowerCase();
  const traceSupplierKey = (tx.paymentTrace?.supplier || "").trim().toLowerCase();
  const label =
    aliasMap.get(descriptionKey) ?? aliasMap.get(traceSupplierKey) ?? tx.paymentTrace?.supplier ?? tx.description;
  const approved = aliasMap.has(descriptionKey) || aliasMap.has(traceSupplierKey);
  return { label, approved };
}

/** Cost-head names for the Merchant Reconciliation filter toolbar's cost-head picker — a lighter read than ledgerData.ts's full getFinanceState() mega-join. */
export async function listManagementCostHeadNames(): Promise<string[]> {
  const rows = await prisma.financeManagementCostHead.findMany({ orderBy: { name: "asc" } });
  return rows.map((r) => r.name);
}

/** Selectable exact source names plus existing approved provider groups. Direct port of merchant_catalog() (merchant_reconcile.py:159-171). */
export async function merchantCatalog(): Promise<{
  providers: Array<{ key: string; id: string; name: string; aliases: string[] }>;
  raw: Array<{ key: string; name: string }>;
}> {
  const [transactions, traces, reviews, providers] = await Promise.all([
    prisma.financeTransaction.findMany({ select: { description: true } }),
    prisma.financePaymentTrace.findMany({ select: { supplier: true } }),
    prisma.financeMerchantReview.findMany({ select: { supplier: true } }),
    prisma.financeMerchantProvider.findMany({ include: { aliases: true }, orderBy: { name: "asc" } }),
  ]);
  const names = new Set<string>();
  for (const t of transactions) if (t.description?.trim()) names.add(t.description.trim());
  for (const t of traces) if (t.supplier?.trim()) names.add(t.supplier.trim());
  for (const r of reviews) if (r.supplier?.trim()) names.add(r.supplier.trim());

  const grouped = new Set<string>();
  const providerGroups = providers.map((p) => {
    for (const a of p.aliases) grouped.add(a.alias.toLowerCase());
    return {
      key: `provider:${p.id}`,
      id: p.id,
      name: p.name,
      aliases: p.aliases.map((a) => a.alias).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
    };
  });
  const raw = Array.from(names)
    .filter((v) => !grouped.has(v.toLowerCase()))
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map((v) => ({ key: `raw:${v}`, name: v }));
  return { providers: providerGroups, raw };
}

export type SupplierSuggestion = {
  key: string;
  name: string;
  aliases: Array<{ name: string; count: number; usd: number; approved: boolean }>;
  approvedAliases: Array<{ name: string; count: number; usd: number; approved: boolean }>;
  count: number;
  totalUsd: number;
  confidence: "Strong match" | "Review suggested";
  reason: string;
};

/**
 * Search real source descriptions for likely related merchant names.
 * Exact name normalisation and a shared distinctive first brand word are
 * cues, not proof. Never auto-approves mappings; suggestions are
 * recomputed from data every call. Direct port of supplier_suggestions()
 * (merchant_reconcile.py:114-157) — port the heuristic exactly, including
 * its two conservative guard clauses (single-word exact-root match, or an
 * identical two-word prefix shared by every record in the bucket).
 */
export async function supplierClusterSuggestions(): Promise<SupplierSuggestion[]> {
  const mapped = await getSupplierAliasMap();

  const grouped = await prisma.financeTransaction.groupBy({
    by: ["description"],
    _count: { _all: true },
    _sum: { amountUsd: true },
  });

  type NameRow = { name: string; count: number; usd: number; approved: boolean };
  const names = new Map<string, NameRow>();
  for (const g of grouped) {
    const raw = (g.description || "").trim();
    if (!raw) continue;
    const key = raw.toLowerCase();
    const existing = names.get(key) ?? { name: raw, count: 0, usd: 0, approved: mapped.has(key) };
    existing.count += g._count._all;
    existing.usd += g._sum.amountUsd ?? 0;
    names.set(key, existing);
  }

  const providers = await prisma.financeMerchantProvider.findMany({ select: { name: true } });
  const providerByLower = new Map(providers.map((p) => [p.name.toLowerCase(), p.name]));

  const groups = new Map<string, NameRow[]>();
  for (const row of names.values()) {
    const key = merchantBrand(row.name);
    if (!key) continue;
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  const output: SupplierSuggestion[] = [];
  for (const [root, records] of groups) {
    const untouched = records.filter((r) => !r.approved);
    const anyApproved = records.some((r) => r.approved);
    if (untouched.length < 2 && !(untouched.length === 1 && (providerByLower.has(root) || anyApproved))) continue;

    // Require at least one brand-root entry or a clearly shared prefix; no fuzzy substring joining.
    const whole = records.filter((r) => r.name.toLowerCase().replace(/[^a-z0-9]/g, "") === root);
    const exactRoot = whole.length > 0;

    // Without a single-word source name or an existing provider, require a
    // shared meaningful two-word prefix. Prevents Apple Pay wrappers and
    // staff first names from combining unrelated suppliers.
    if (!exactRoot && !providerByLower.has(root)) {
      // Mirror the Python tuple-length check: every record's first-two-token
      // prefix must be identical AND have exactly two tokens (prevents a
      // single-word name or a mismatched prefix from joining the group).
      const firstPairTokens = tokenize(records[0].name).slice(0, 2);
      const allSameTwoTokens =
        firstPairTokens.length === 2 &&
        records.every((r) => {
          const t = tokenize(r.name).slice(0, 2);
          return t.length === 2 && t[0] === firstPairTokens[0] && t[1] === firstPairTokens[1];
        });
      if (!allSameTwoTokens) continue;
    }

    const canonical =
      providerByLower.get(root) ??
      (whole.length > 0 ? whole.reduce((a, b) => (b.name.length < a.name.length ? b : a)).name : root[0].toUpperCase() + root.slice(1));

    const aliases = [...untouched]
      .sort((a, b) => b.count - a.count || a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
      .map((a) => ({ name: a.name, count: a.count, usd: Math.round(a.usd * 100) / 100, approved: a.approved }));
    const approvedAliases = records
      .filter((r) => r.approved)
      .slice(0, 12)
      .map((a) => ({ name: a.name, count: a.count, usd: Math.round(a.usd * 100) / 100, approved: a.approved }));

    output.push({
      key: root,
      name: canonical,
      aliases,
      approvedAliases,
      count: aliases.reduce((sum, a) => sum + a.count, 0),
      totalUsd: Math.round(aliases.reduce((sum, a) => sum + a.usd, 0) * 100) / 100,
      confidence: exactRoot ? "Strong match" : "Review suggested",
      reason: exactRoot
        ? "An exact company-name payment and matching prefixed descriptions"
        : "Descriptions share an initial company word; verify that they are the same supplier",
    });
  }

  output.sort((a, b) => b.count - a.count || b.aliases.length - a.aliases.length || a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
  return output.slice(0, 200);
}

// ---------------------------------------------------------------------
// Alias approve / ungroup — the only merchant-reconciliation mutations
// that need undo support (FinanceMerchantAlias is in REVERTIBLE_TABLES).
// Direct port of assign_aliases() / ungroup_alias()
// (merchant_reconcile.py:205-243).
// ---------------------------------------------------------------------

export type ApproveClusterResult =
  | { ok: true; providerId: string; name: string; added: number; changeId: string }
  | { ok: false; status: number; error: string };

/**
 * Approves a suggested cluster (or an ad-hoc set of raw descriptions)
 * into a FinanceMerchantProvider/FinanceMerchantAlias pair. Nothing is
 * auto-applied before this call — a reviewer must explicitly name the
 * canonical provider and the exact raw descriptions to group.
 */
export async function approveSupplierCluster(params: {
  organizationId?: string | null;
  providerName: string;
  aliases: string[];
  actorId: string;
  actorEmail: string;
}): Promise<ApproveClusterResult> {
  const name = clamp(params.providerName, 150);
  if (!name) return { ok: false, status: 400, error: "Provider name and reviewer are required" };
  if (!Array.isArray(params.aliases) || params.aliases.length < 1 || params.aliases.length > 100) {
    return { ok: false, status: 400, error: "Select one or more existing merchant names" };
  }

  const catalog = await merchantCatalog();
  const known = new Map(catalog.raw.map((x) => [x.name.toLowerCase(), x.name]));
  const chosen: string[] = [];
  const seen = new Set<string>();
  for (const a of params.aliases) {
    const alias = clamp(a, 350);
    const key = alias.toLowerCase();
    if (!known.has(key)) return { ok: false, status: 400, error: `Unknown or already grouped merchant name: ${alias}` };
    if (!seen.has(key)) {
      seen.add(key);
      chosen.push(known.get(key)!);
    }
  }

  const before = await revisionItems("FinanceMerchantAlias", chosen);

  let provider = await prisma.financeMerchantProvider.findFirst({ where: { name } });
  if (!provider) {
    provider = await prisma.financeMerchantProvider.create({
      data: { organizationId: params.organizationId ?? null, name, createdAt: new Date() },
    });
  }
  for (const alias of chosen) {
    const existingAlias = await prisma.financeMerchantAlias.findFirst({ where: { alias } });
    if (existingAlias) return { ok: false, status: 400, error: `Merchant name was already assigned: ${alias}` };
    await prisma.financeMerchantAlias.create({
      data: { organizationId: params.organizationId ?? null, alias, providerId: provider.id },
    });
  }

  const after = await revisionItems("FinanceMerchantAlias", chosen);
  const changeId = await logReversible({
    organizationId: params.organizationId ?? null,
    action: "merchant_provider_group",
    description: `Reporting supplier: ${name} · ${chosen.length} original descriptions`,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    before,
    after,
  });

  return { ok: true, providerId: provider.id, name, added: chosen.length, changeId };
}

export type UngroupAliasResult = { ok: true; changeId: string } | { ok: false; status: number; error: string };

/** Removes one approved alias from a provider. Direct port of ungroup_alias(). */
export async function ungroupSupplierAlias(params: {
  organizationId?: string | null;
  providerId: string;
  alias: string;
  actorId: string;
  actorEmail: string;
}): Promise<UngroupAliasResult> {
  const alias = clamp(params.alias, 350);
  const existing = await prisma.financeMerchantAlias.findFirst({
    where: { providerId: params.providerId, alias },
  });
  if (!existing) return { ok: false, status: 404, error: "This provider mapping no longer exists" };

  const before = await revisionItems("FinanceMerchantAlias", [alias]);
  await prisma.financeMerchantAlias.delete({ where: { id: existing.id } });
  const after = await revisionItems("FinanceMerchantAlias", [alias]);

  const changeId = await logReversible({
    organizationId: params.organizationId ?? null,
    action: "merchant_alias_ungroup",
    description: `Remove supplier alias: ${alias}`,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    before,
    after,
  });
  return { ok: true, changeId };
}

// ---------------------------------------------------------------------
// 3. Excel round-trip review workflow
//    merchant_reconcile.py:19-20, 295-476
// ---------------------------------------------------------------------

/**
 * Column layout for the exported review workbook, direct port of COLUMNS
 * (merchant_reconcile.py:19). `immutable: true` columns are ERP/bank
 * fields the server re-validates on import regardless of the XLSX's own
 * cell-protection (see validateImportRow below) — Excel locking is UX
 * only, never a security boundary. Adapted to this port's slimmer
 * FinanceMerchantReview model: no "What is this payment for?" (purpose),
 * invoice number, vendor reference, reviewer or notes columns exist here.
 */
export const MERCHANT_REVIEW_COLUMNS = [
  { key: "transactionId", label: "Payment ID (DO NOT EDIT)", immutable: true },
  { key: "paymentDate", label: "Date (DO NOT EDIT)", immutable: true },
  { key: "supplier", label: "Reporting supplier (DO NOT EDIT)", immutable: true },
  { key: "description", label: "Original payment description (DO NOT EDIT)", immutable: true },
  { key: "paymentReference", label: "Bank reference (DO NOT EDIT)", immutable: true },
  { key: "erpPaymentId", label: "ERP payment ID (DO NOT EDIT)", immutable: true },
  { key: "amountUsd", label: "Amount USD (DO NOT EDIT)", immutable: true },
  { key: "product", label: "Product / Subscription", immutable: false },
  { key: "owner", label: "Subscription owner", immutable: false },
  { key: "users", label: "Employee / Licence users (emails, separated by ;)", immutable: false },
  { key: "department", label: "Department", immutable: false },
  { key: "costHead", label: "Cost head", immutable: false },
] as const;

export type MerchantReviewExportRow = {
  transactionId: string;
  paymentDateIso: string;
  supplier: string;
  description: string;
  paymentReference: string;
  erpPaymentId: string;
  amountUsd: number;
  product: string;
  owner: string;
  users: string;
  department: string;
  costHead: string;
  /** cell key -> locked, mirrors the source's per-cell Protection() logic (merchant_reconcile.py:313-323): immutable columns and any already-populated editable cell are locked. */
  locked: Record<string, boolean>;
};

/**
 * Builds the row data for a merchant/cost-head/FY review export. Produces
 * the business data and the lock map the source encodes as real XLSX cell
 * protection (merchant_reconcile.py:295-345); actual workbook byte
 * generation (openpyxl -> exceljs) is left to a later stage per the task
 * brief, since exceljs isn't wired into this repo yet.
 */
export async function buildMerchantReviewExportRows(params: {
  merchant?: string;
  costHead?: string;
  fyStart?: number;
}): Promise<MerchantReviewExportRow[]> {
  const { start, end } = fiscalYearMonthWindow(params.fyStart ?? null);
  const merchantQuery = (params.merchant ?? "").trim().toLowerCase();

  const transactions = await prisma.financeTransaction.findMany({
    where: { month: { gte: start, lte: end } },
    include: { paymentTrace: true, allocation: true },
    orderBy: [{ paymentDate: "asc" }, { id: "asc" }],
  });
  const reviews = await prisma.financeMerchantReview.findMany({
    where: { transaction: { month: { gte: start, lte: end } } },
  });
  const reviewByTx = new Map(reviews.map((r) => [r.transactionId, r]));
  const aliasMap = await getSupplierAliasMap();
  // Same effective-cost-head precedence as filtered_head_rows()
  // (merchant_reconcile.py:48-59): per-payment override, else legacy
  // mapping, else original centre, else 'Needs allocation'.
  const effectiveHeads = params.costHead
    ? new Map((await effectiveCostHeadsForWindow(params.fyStart ?? null)).map((r) => [r.transactionId, r.effectiveHead]))
    : null;

  const rows: MerchantReviewExportRow[] = [];
  for (const t of transactions) {
    const descriptionKey = (t.description || "").trim().toLowerCase();
    const traceSupplierKey = (t.paymentTrace?.supplier || "").trim().toLowerCase();
    const reportingSupplier =
      aliasMap.get(descriptionKey) ?? aliasMap.get(traceSupplierKey) ?? t.paymentTrace?.supplier ?? t.description;

    if (merchantQuery) {
      const haystacks = [t.description, t.paymentTrace?.supplier ?? "", reportingSupplier].map((s) =>
        s.toLowerCase()
      );
      if (!haystacks.some((h) => h.includes(merchantQuery))) continue;
    }
    if (params.costHead && effectiveHeads) {
      const effective = effectiveHeads.get(t.id) || "";
      if (effective.toLowerCase() !== params.costHead.toLowerCase()) continue;
    }

    const review = reviewByTx.get(t.id);
    const product = review?.product ?? "";
    const owner = review?.owner ?? "";
    const users = review?.users ?? "";
    const department = review?.department ?? "";
    const costHead = review?.costHead ?? "";

    rows.push({
      transactionId: t.id,
      paymentDateIso: t.paymentDate ? t.paymentDate.toISOString().slice(0, 10) : "",
      supplier: reportingSupplier,
      description: t.description,
      paymentReference: t.paymentTrace?.paymentReference ?? "",
      erpPaymentId: t.paymentTrace?.erpPaymentId ?? "",
      amountUsd: t.amountUsd,
      product,
      owner,
      users,
      department,
      costHead,
      locked: {
        transactionId: true,
        paymentDate: true,
        supplier: true,
        description: true,
        paymentReference: true,
        erpPaymentId: true,
        amountUsd: true,
        product: Boolean(product),
        owner: Boolean(owner),
        users: Boolean(users),
        department: Boolean(department),
        costHead: Boolean(costHead),
      },
    });
  }
  return rows;
}

/** One row of a returned/re-imported review workbook, already parsed into plain values (XLSX parsing itself is a later-stage concern). */
export type MerchantReviewImportRow = {
  transactionId: string;
  paymentDateIso: string;
  supplier: string;
  description: string;
  paymentReference: string;
  erpPaymentId: string;
  amountUsd: number;
  product: string;
  owner: string;
  users: string;
  department: string;
  costHead: string;
};

export type ValidatedImportRow = MerchantReviewImportRow & {
  status: "Ready" | "Unanswered" | "Already applied";
  error: string | null;
  emails: string[];
};

/**
 * Re-validates every "should be immutable" field for one re-imported
 * review row, exactly the way the source does in parsed_xlsx()
 * (merchant_reconcile.py:362-428) — Excel's cell protection only stops a
 * casual edit in the UI; a modified XLSX can set any cell to anything, so
 * every immutable field must be re-checked against the database, not just
 * trusted because the template said "DO NOT EDIT".
 *
 * Adapted to this port's schema: there is no purpose/notes/invoice
 * number/vendor reference/reviewer column, so the "Unanswered / Needs
 * identification / Already applied / Ready" status logic
 * (merchant_reconcile.py:420-426) collapses two source states
 * (Unanswered vs Needs identification, which the source split on
 * purpose/notes presence) into one "Unanswered" state here. Flagged for
 * double-check.
 */
export async function validateImportRow(row: MerchantReviewImportRow): Promise<ValidatedImportRow> {
  const tid = clamp(row.transactionId, 200);
  const base: ValidatedImportRow = {
    ...row,
    transactionId: tid,
    product: clamp(row.product, 160),
    owner: clamp(row.owner, 150),
    users: clamp(row.users, 1500),
    department: clamp(row.department, 100),
    costHead: clamp(row.costHead, 160),
    status: "Unanswered",
    error: null,
    emails: [],
  };
  if (!tid) return { ...base, error: "Blank payment ID in workbook" };

  const tx = await prisma.financeTransaction.findUnique({
    where: { id: tid },
    include: { paymentTrace: true, allocation: true },
  });
  if (!tx) return { ...base, error: "Payment ID no longer exists" };

  // Immutable ERP/bank fields: amount (0.015 tolerance, matching the
  // source's rounding slack) and date.
  const txDateIso = tx.paymentDate ? tx.paymentDate.toISOString().slice(0, 10) : "";
  if (row.paymentDateIso !== txDateIso || Math.abs((row.amountUsd || 0) - tx.amountUsd) > 0.015) {
    return { ...base, error: "Immutable amount or date changed, re-export the template" };
  }
  if (
    clamp(row.description, 1500) !== tx.description ||
    clamp(row.paymentReference, 200) !== (tx.paymentTrace?.paymentReference ?? "") ||
    clamp(row.erpPaymentId, 200) !== (tx.paymentTrace?.erpPaymentId ?? "")
  ) {
    return { ...base, error: "Immutable ledger description or payment reference changed" };
  }

  // Protected supplier label: must still be one of the labels this
  // payment is legitimately known by (raw description, raw trace
  // supplier, any approved alias mapping to those, or a prior review's
  // supplier) — prevents a reviewer silently renaming the supplier
  // identity inside an otherwise-editable workbook.
  const sourceLabels = new Set<string>([tx.description.trim().toLowerCase()]);
  if (tx.paymentTrace?.supplier) sourceLabels.add(tx.paymentTrace.supplier.trim().toLowerCase());
  if (sourceLabels.size) {
    const providerRows = await prisma.financeMerchantAlias.findMany({
      where: { alias: { in: Array.from(sourceLabels) } },
      include: { provider: true },
    });
    for (const p of providerRows) sourceLabels.add(p.provider.name.trim().toLowerCase());
  }
  const previousReview = await prisma.financeMerchantReview.findUnique({ where: { transactionId: tid } });
  if (previousReview?.supplier) sourceLabels.add(previousReview.supplier.trim().toLowerCase());
  if (!sourceLabels.has(clamp(row.supplier, 150).toLowerCase())) {
    return { ...base, error: "Protected supplier label was modified, download a fresh template" };
  }

  if (base.department && base.department.length > 0) {
    const validDept = await prisma.financeManagementDepartment.findFirst({ where: { name: base.department } });
    if (!validDept) return { ...base, error: "Department is not an existing department" };
  }
  if (base.costHead) {
    const validHead = await prisma.financeManagementCostHead.findFirst({ where: { name: base.costHead } });
    if (!validHead) return { ...base, error: "Cost head does not exist, create it in Organise Costs first" };
  }
  if (Boolean(base.department) !== Boolean(base.costHead)) {
    return { ...base, error: "Choose department and cost head together" };
  }

  const { emails, error: emailError } = parseEmailList(base.users);
  if (emailError) return { ...base, error: emailError };
  base.emails = emails;

  // Excel protection is advisory. Enforce immutability of populated
  // review fields server-side: once a field has been identified, only the
  // dashboard (not a re-imported workbook) may change it.
  if (previousReview) {
    const immutableOnceSet: Array<[keyof typeof previousReview, string]> = [
      ["product", base.product],
      ["owner", base.owner],
      ["users", base.users],
      ["department", base.department],
      ["costHead", base.costHead],
    ];
    for (const [field, newValue] of immutableOnceSet) {
      const oldValue = previousReview[field];
      if (oldValue && String(oldValue) !== String(newValue)) {
        return { ...base, error: "A previously identified field was modified. Edit that field through the dashboard instead." };
      }
    }
  }

  const priorAllocation = tx.allocation;
  if (
    priorAllocation &&
    ((priorAllocation.department && priorAllocation.department !== base.department) ||
      (priorAllocation.costHead && priorAllocation.costHead !== base.costHead))
  ) {
    return { ...base, error: "An existing cost classification was modified. Edit that field through the dashboard instead." };
  }

  if (!base.product) {
    base.status = "Unanswered";
  } else if (
    previousReview &&
    [
      ["product", base.product],
      ["owner", base.owner],
      ["users", base.users],
      ["department", base.department],
      ["costHead", base.costHead],
    ].every(([k, v]) => String((previousReview as Record<string, unknown>)[k as string] ?? "") === String(v ?? ""))
  ) {
    base.status = "Already applied";
  } else {
    base.status = "Ready";
  }
  return base;
}

export async function validateImportRows(rows: MerchantReviewImportRow[]): Promise<ValidatedImportRow[]> {
  const seen = new Set<string>();
  const out: ValidatedImportRow[] = [];
  for (const row of rows) {
    const validated = await validateImportRow(row);
    if (seen.has(validated.transactionId)) {
      out.push({ ...validated, error: validated.error ?? "Blank or repeated payment ID in workbook" });
      continue;
    }
    seen.add(validated.transactionId);
    out.push(validated);
  }
  return out;
}

export type CommitImportResult =
  | { ok: true; applied: number; skipped: number; batchId: string }
  | { ok: false; status: number; error: string };

/**
 * Applies a previously validated import (re-validates again defensively —
 * "no rows changed" must hold even if the caller's validation snapshot is
 * stale). Direct port of commit() (merchant_reconcile.py:439-476), scoped
 * to the models this sub-domain owns: it upserts FinanceMerchantReview
 * rows and records a batch. It deliberately does NOT also write
 * FinanceAllocation or create FinanceSubscription rows the way the
 * source's commit() does (lines 455-472) — allocation/classification
 * writes belong to ledgerData.ts's classifyTransaction(), and
 * subscriptions aren't part of this port's merchant-reconciliation model
 * set. Flagged for double-check: a later integration stage may want this
 * import to also call classifyTransaction() per row when department+
 * costHead are present.
 */
export async function commitMerchantReviewImport(params: {
  organizationId?: string | null;
  rows: MerchantReviewImportRow[];
  allowOverwrite?: boolean;
  merchant?: string;
  costHead?: string;
  fyStart?: number;
}): Promise<CommitImportResult> {
  const validated = await validateImportRows(params.rows);
  if (validated.some((r) => r.error)) {
    return { ok: false, status: 400, error: "Correct invalid rows before importing. No rows were changed." };
  }
  const ready = validated.filter((r) => r.status === "Ready");
  const batch = await createMerchantReviewBatch({
    organizationId: params.organizationId,
    merchant: params.merchant,
    costHead: params.costHead,
    fyStart: params.fyStart,
  });
  if (ready.length === 0) {
    await markMerchantBatchStatus(batch.id, "committed");
    return { ok: true, applied: 0, skipped: validated.length, batchId: batch.id };
  }

  let applied = 0;
  for (const r of ready) {
    const existing = await prisma.financeMerchantReview.findUnique({ where: { transactionId: r.transactionId } });
    if (existing && !params.allowOverwrite) {
      return {
        ok: false,
        status: 409,
        error: `Payment ${r.transactionId} already has a review. Re-preview and explicitly allow replacing existing reviews.`,
      };
    }
    await prisma.financeMerchantReview.upsert({
      where: { transactionId: r.transactionId },
      create: {
        organizationId: params.organizationId ?? null,
        transactionId: r.transactionId,
        supplier: r.supplier || null,
        product: r.product || null,
        owner: r.owner || null,
        users: r.users || null,
        department: r.department || null,
        costHead: r.costHead || null,
      },
      update: {
        supplier: r.supplier || null,
        product: r.product || null,
        owner: r.owner || null,
        users: r.users || null,
        department: r.department || null,
        costHead: r.costHead || null,
      },
    });
    applied++;
  }
  await markMerchantBatchStatus(batch.id, "committed");
  return { ok: true, applied, skipped: validated.length - applied, batchId: batch.id };
}

// ---------------------------------------------------------------------
// 4. Invoice evidence
//    merchant_reconcile.py:478-570 (upload/validate), 580-670 (field
//    suggestions + payment matching), 634-726 (link)
// ---------------------------------------------------------------------

/**
 * Validates invoice metadata fields — the subset of invoice_input()
 * (merchant_reconcile.py:478-502) that still has a column in this port's
 * FinanceMerchantInvoice model. The source also validates department,
 * cost head, legal entity, invoice number and the uploaded file's byte
 * signature; none of those have a column here (see schema note below),
 * so that validation is dropped rather than invented onto fields that
 * don't exist in this port.
 *
 * Schema note: FinanceMerchantInvoice in this port has no invoiceNumber,
 * department, costHead, legalEntity, owner, usersText or notes column
 * (unlike the source's merchant_invoices table) — only
 * supplier/documentId/extractedText/amount/currency/invoiceDate. Flagged
 * for double-check: if invoice-number-based duplicate detection or
 * department/cost-head tagging on invoices is still wanted, the Prisma
 * model needs those columns added in a later migration.
 */
export function validateInvoiceFields(input: {
  supplier: string;
  amount: number;
  currency: string;
  invoiceDateIso?: string;
}): { ok: true; supplier: string; amount: number; currency: string; invoiceDate: Date | null } | { ok: false; error: string } {
  const supplier = clamp(input.supplier, 150);
  if (!supplier) return { ok: false, error: "Supplier is required" };
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) return { ok: false, error: "Invalid invoice amount" };
  const currency = clamp(input.currency, 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: "A three-letter invoice currency is required" };
  let invoiceDate: Date | null = null;
  if (input.invoiceDateIso) {
    const d = new Date(input.invoiceDateIso);
    if (Number.isNaN(d.getTime())) return { ok: false, error: "invoiceDate must be a valid YYYY-MM-DD date" };
    invoiceDate = d;
  }
  return { ok: true, supplier, amount, currency, invoiceDate };
}

/**
 * Checks a file's magic bytes against its declared extension — direct
 * port of validate_invoice_bytes() (merchant_reconcile.py:532-538).
 * Security: enforce known file signatures, not MIME declarations alone.
 * Pure byte-sniffing logic; actual blob upload happens in a later stage
 * via lib/blobStorage.ts.
 */
export function validateInvoiceFileSignature(contents: Buffer, filename: string): { ok: true; kind: "pdf" | "png" | "jpg" } | { ok: false; error: string } {
  if (!contents || contents.length === 0 || contents.length > 10 * 1024 * 1024) {
    return { ok: false, error: "Invoices must be 10 MB or smaller" };
  }
  const suffix = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
  if (suffix === "pdf" && contents.subarray(0, 5).toString("latin1") === "%PDF-") return { ok: true, kind: "pdf" };
  if (suffix === "png" && contents.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ok: true, kind: "png" };
  }
  if ((suffix === "jpg" || suffix === "jpeg") && contents.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
    return { ok: true, kind: "jpg" };
  }
  return { ok: false, error: "Please upload a genuine PDF, PNG or JPEG invoice" };
}

/**
 * Creates the FinanceMerchantInvoice record. Takes an already-uploaded
 * documentId (blob storage) and already-extracted text — the actual
 * upload + text-extraction wiring is a later (API route) stage, per the
 * task brief. Unlike the source's save_invoice() (merchant_reconcile.py:
 * 504-530), there is no (supplier, invoice_number, sha256) column set to
 * dedupe against here (no invoiceNumber/sha256 columns in this port), so
 * duplicate detection is dropped rather than approximated. Flagged for
 * double-check.
 */
export async function createMerchantInvoice(params: {
  organizationId?: string | null;
  supplier: string;
  amount: number;
  currency: string;
  invoiceDateIso?: string;
  documentId?: string | null;
  extractedText?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; status: number; error: string }> {
  const validated = validateInvoiceFields(params);
  if (!validated.ok) return { ok: false, status: 400, error: validated.error };
  const invoice = await prisma.financeMerchantInvoice.create({
    data: {
      organizationId: params.organizationId ?? null,
      supplier: validated.supplier,
      amount: validated.amount,
      currency: validated.currency,
      invoiceDate: validated.invoiceDate,
      documentId: params.documentId ?? null,
      extractedText: params.extractedText ?? null,
    },
  });
  return { ok: true, id: invoice.id };
}

// --- Field-suggestion extraction (best-effort regex parsing) ----------

export type InvoiceFieldEvidence = { source: string; confidence: "strong" | "suggested" | "needs review" };
export type InvoiceFieldSuggestions = {
  fields: { supplier?: string; invoiceNumber?: string; issueDate?: string; dueDate?: string; amount?: number; currency?: string };
  evidence: Record<string, InvoiceFieldEvidence>;
  warnings: string[];
};

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

/** Best-effort date parsing across the source's supported formats (merchant_reconcile.py:572-577). Returns an ISO date string or ''. */
export function parseInvoiceDate(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "";
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m && MONTHS[m[2].toLowerCase()] !== undefined) {
    return `${m[3]}-${String(MONTHS[m[2].toLowerCase()] + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = s.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (m && MONTHS[m[1].toLowerCase()] !== undefined) {
    return `${m[3]}-${String(MONTHS[m[1].toLowerCase()] + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }
  return "";
}

/**
 * Regex-based suggested invoice fields from extracted text. Direct port
 * of analyse_invoice()'s field-suggestion half (merchant_reconcile.py:
 * 580-631), adapted to use known FinanceMerchantProvider names as the
 * "known supplier" candidate list instead of the source's subscriptions
 * table (subscriptions aren't part of this port's merchant-reconciliation
 * model set, so the source's per-subscription service-matching, lines
 * 620-623, is dropped here).
 */
export async function extractInvoiceFieldSuggestions(text: string): Promise<InvoiceFieldSuggestions> {
  const fields: InvoiceFieldSuggestions["fields"] = {};
  const evidence: InvoiceFieldSuggestions["evidence"] = {};
  const warnings: string[] = [];
  const pick = (
    label: keyof InvoiceFieldSuggestions["fields"],
    value: string | number | undefined,
    evidenceText: string,
    confidence: InvoiceFieldEvidence["confidence"] = "suggested"
  ) => {
    if (value === undefined || value === "") return;
    (fields as Record<string, unknown>)[label] = value;
    evidence[label] = { source: evidenceText.slice(0, 180), confidence };
  };

  const lines = text
    .split(/\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const providers = await prisma.financeMerchantProvider.findMany({ select: { name: true } });
  const supplierCandidates = providers.map((p) => p.name).filter((n) => n.length > 2).sort((a, b) => b.length - a.length);
  const firstPage = lines.slice(0, 80).join("\n");
  const lower = firstPage.toLowerCase();
  const matchedSupplier = supplierCandidates.find((name) => lower.includes(name.toLowerCase()));
  if (matchedSupplier) {
    pick("supplier", matchedSupplier, "Existing supplier name found in document", "strong");
  } else if (lines.length) {
    const likely = lines
      .slice(0, 9)
      .find((l) => l.length > 3 && l.length < 100 && !/^(invoice|bill|statement|tax invoice|date|page|issued by|www\.|https?:\/\/)/i.test(l));
    if (likely) pick("supplier", likely, `Invoice header: ${likely}`, "needs review");
  }

  const invoiceNumberMatch = text.match(
    /^\s*(?:invoice\s*(?:number|no\.?|#)|bill\s*(?:number|no\.?|#)|invoice id)\s*[:#-]?\s*([A-Z0-9][A-Z0-9\-/_]{2,50})/im
  );
  if (invoiceNumberMatch) pick("invoiceNumber", invoiceNumberMatch[1].trim(), invoiceNumberMatch[0], "suggested");

  const issueDateMatch = text.match(/^\s*(?:invoice date|issue date|date of issue|date issued)\s*:?\s*([A-Za-z0-9, /\-]{8,26})/im);
  if (issueDateMatch) {
    const parsed = parseInvoiceDate(issueDateMatch[1].trim());
    if (parsed) pick("issueDate", parsed, issueDateMatch[0], "suggested");
  }
  const dueDateMatch = text.match(/^\s*(?:due date|payment due|pay by)\s*:?\s*([A-Za-z0-9, /\-]{8,26})/im);
  if (dueDateMatch) {
    const parsed = parseInvoiceDate(dueDateMatch[1].trim());
    if (parsed) pick("dueDate", parsed, dueDateMatch[0], "suggested");
  }

  const amountPattern =
    /^\s*(grand total|total due|amount due|balance due|total payable|invoice total|total inc\.? vat)\s*:?\s*(?:(USD|GBP|AED|PKR|EUR|SAR|CAD)\s*)?([£$€₨]|PKR\s*)?\s*([0-9][0-9,]*(?:\.[0-9]{2})?)/gim;
  const totals: Array<{ match: RegExpMatchArray; value: number }> = [];
  for (const match of text.matchAll(amountPattern)) {
    const value = parseFloat(match[4].replace(/,/g, ""));
    if (value > 0 && value < 1e12) totals.push({ match, value });
  }
  if (totals.length) {
    const { match, value } = totals[totals.length - 1];
    pick("amount", Math.round(value * 100) / 100, match[0], "suggested");
    const symbolToCurrency: Record<string, string> = { "£": "GBP", $: "USD", "€": "EUR", "₨": "PKR" };
    const currency = (match[2] || "").toUpperCase() || symbolToCurrency[(match[3] || "").trim()];
    if (currency) pick("currency", currency, match[0], "suggested");
  }
  if (!fields.currency) {
    const m = text.match(/\b(?:USD|GBP|AED|PKR|EUR|SAR|CAD)\b/i);
    if (m) pick("currency", m[0].toUpperCase(), "Currency code found in document", "needs review");
  }
  if (!fields.currency) warnings.push("Currency not identified. Confirm original invoice currency manually.");
  if (!fields.invoiceNumber) warnings.push("Invoice number not detected. Verify it before saving.");
  if (!fields.amount) warnings.push("Invoice total not detected. Enter it before saving.");

  return { fields, evidence, warnings };
}

// --- Invoice-to-payment suggested matching -----------------------------

export type InvoiceMatchCandidate = {
  transactionId: string;
  paymentDate: Date | null;
  description: string;
  paymentAmountUsd: number;
  confidence: string;
  confirmed: boolean;
  rank: number;
};

/**
 * Suggests ledger payments that could correspond to an invoice, ranked by
 * supplier-name match + amount match (and, when an issue date is given,
 * within 120 days of the payment). Adapted port of candidates()
 * (merchant_reconcile.py:645-670): the source's strongest signal — an
 * exact ERP/review invoice-number match — cannot be ported, because
 * neither FinanceMerchantInvoice nor FinanceMerchantReview has an
 * invoice-number column in this port's schema. With that signal removed,
 * this function requires BOTH a supplier-name match AND an amount match
 * before suggesting a candidate (the source only required one signal
 * when a reference match was also present) to keep the suggestion
 * conservative given less evidence. Flagged prominently for double-check
 * against source lines 645-670 and the schema given for this task.
 */
export async function suggestPaymentMatchesForInvoice(invoice: {
  supplier: string;
  amount: number;
  currency: string;
  invoiceDateIso?: string | null;
}): Promise<InvoiceMatchCandidate[]> {
  const supplier = (invoice.supplier || "").trim().toLowerCase();
  if (!supplier || !invoice.amount) return [];

  const transactions = await prisma.financeTransaction.findMany({
    where: {
      OR: [
        { description: { contains: invoice.supplier } },
        { paymentTrace: { is: { supplier: { contains: invoice.supplier } } } },
      ],
    },
    include: { paymentTrace: true },
    orderBy: { paymentDate: "desc" },
    take: 400,
  });
  const reviews = await prisma.financeMerchantReview.findMany({
    where: { transactionId: { in: transactions.map((t) => t.id) } },
  });
  const reviewByTx = new Map(reviews.map((r) => [r.transactionId, r]));

  const results: InvoiceMatchCandidate[] = [];
  for (const t of transactions) {
    const review = reviewByTx.get(t.id);
    const matchedSupplier =
      t.description.toLowerCase().includes(supplier) ||
      (t.paymentTrace?.supplier ?? "").toLowerCase().includes(supplier) ||
      (review?.supplier ?? "").toLowerCase().includes(supplier);
    if (!matchedSupplier) continue;

    if (invoice.invoiceDateIso) {
      const invoiceDate = new Date(invoice.invoiceDateIso);
      const days = t.paymentDate ? Math.abs((invoiceDate.getTime() - t.paymentDate.getTime()) / 86400000) : NaN;
      if (Number.isFinite(days) && days > 120) continue;
    }

    const nativeMatch =
      t.paymentTrace?.sourceCurrency === invoice.currency &&
      t.paymentTrace?.sourceAmount != null &&
      Math.abs(t.paymentTrace.sourceAmount - invoice.amount) < 0.02;
    const usdMatch = invoice.currency === "USD" && Math.abs(t.amountUsd - invoice.amount) < 0.02;
    const amountMatch = nativeMatch || usdMatch;
    if (!amountMatch) continue;

    const rank = 2 + 1; // amountMatch (2) + matchedSupplier (1); reference signal unavailable, see doc comment above
    const existingLink = await prisma.financeMerchantInvoiceLink.findFirst({
      where: { transactionId: t.id },
    });
    results.push({
      transactionId: t.id,
      paymentDate: t.paymentDate,
      description: t.description,
      paymentAmountUsd: t.amountUsd,
      confidence: "Supplier and matching amount, review",
      confirmed: Boolean(existingLink),
      rank,
    });
  }
  return results.sort((a, b) => b.rank - a.rank || (b.paymentDate?.getTime() ?? 0) - (a.paymentDate?.getTime() ?? 0)).slice(0, 15);
}

export type LinkInvoiceResult =
  | { ok: true; linked: true }
  | { ok: true; linked: false; duplicate: true }
  | { ok: false; status: number; error: string };

/**
 * Records Finance's explicit approval of a suggested invoice-to-payment
 * match. Direct port of link_evidence() (merchant_reconcile.py:634-643) —
 * the invoiceType branch (General vs Subscription) and the subscription
 * side-effects in link() (lines 693-726) are not ported, since
 * subscriptions aren't part of this port's merchant-reconciliation model
 * set (see createMerchantInvoice doc comment).
 */
export async function linkInvoiceToTransaction(params: {
  organizationId?: string | null;
  invoiceId: string;
  transactionId: string;
}): Promise<LinkInvoiceResult> {
  const invoice = await prisma.financeMerchantInvoice.findUnique({ where: { id: params.invoiceId } });
  if (!invoice) return { ok: false, status: 404, error: "Invoice not found" };
  const transaction = await prisma.financeTransaction.findUnique({ where: { id: params.transactionId } });
  if (!transaction) return { ok: false, status: 404, error: "Payment does not exist" };

  const existing = await prisma.financeMerchantInvoiceLink.findFirst({
    where: { invoiceId: params.invoiceId, transactionId: params.transactionId },
  });
  if (existing) return { ok: true, linked: false, duplicate: true };

  await prisma.financeMerchantInvoiceLink.create({
    data: {
      organizationId: params.organizationId ?? null,
      invoiceId: params.invoiceId,
      transactionId: params.transactionId,
    },
  });
  return { ok: true, linked: true };
}
