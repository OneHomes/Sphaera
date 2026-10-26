import { prisma } from "../prisma";

// Registry of One Homes' three independent regional ERP installations
// (Pakistan / UAE / UK & USA — same vendor's software, three separate
// deployments). Ported from the source Python app's `erp_registry.py`
// (103 lines) plus the ERP-staging/resolution endpoints in `server.py`
// (`stage_erp_items`, `stage_erp_fund_movements`, `erp_fund_summary`,
// `resolve_erp_item`, `erp_status`, `latest_erp_bank_balances`,
// `stage_bank_balances`).
//
// `region` is the authoritative source identity used to disambiguate
// inbound records — it is NOT a fund or department. The composite
// (sourceId, externalId) uniqueness on FinanceErpSyncStaging exists so the
// same external/internal ID minted by two different regional ERPs can
// never collide or silently overwrite one another.
//
// This registry stores only non-secret connection metadata and never
// connects to a real ERP or performs live automated ingestion — it is a
// manual staging/review queue that accepts data pushed to it and lets a
// human resolve it, matching the source app's explicit design ("Source
// registry for multiple One Homes ERP systems. No direct ERP
// connections.").

export const ERP_REGIONS = ["Pakistan", "UAE", "UK & USA"] as const;
export type ErpRegion = (typeof ERP_REGIONS)[number];

export const ERP_ENVIRONMENTS = ["Production", "Test / UAT"] as const;

export const ERP_INTEGRATION_MODES = ["Read-only C# API", "Read-only SQL Server bridge"] as const;

// Retained only for historic database compatibility with the source app's
// schema. ERP ownership is geography (region), not funds — the source
// forces this constant on every create/update regardless of input.
const LEGACY_DEFAULT_DEPARTMENT = "Both funds";

// --- ERP source registry CRUD ------------------------------------------

export type ErpSourceSummary = Awaited<ReturnType<typeof prisma.financeErpSource.findMany>>[number] & {
  stagedCount: number;
  pendingCount: number;
  status: "Awaiting IT integration" | "Inactive";
};

/**
 * Direct port of list_sources(): every registered ERP source plus its
 * staged-record and pending-match counts, ordered active-first, then by
 * region (Pakistan, UAE, UK & USA, anything else), then by name.
 */
export async function listErpSources(): Promise<ErpSourceSummary[]> {
  const sources = await prisma.financeErpSource.findMany({
    include: { stagingRecords: { select: { status: true } } },
  });

  const regionOrder: Record<string, number> = { Pakistan: 1, UAE: 2, "UK & USA": 3 };

  return sources
    .map((s) => {
      const { stagingRecords, ...rest } = s;
      return {
        ...rest,
        stagedCount: stagingRecords.length,
        pendingCount: stagingRecords.filter((r) => r.status === "pending").length,
        status: (s.active ? "Awaiting IT integration" : "Inactive") as "Awaiting IT integration" | "Inactive",
      };
    })
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      const ra = regionOrder[a.region ?? ""] ?? 4;
      const rb = regionOrder[b.region ?? ""] ?? 4;
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
}

export type SaveErpSourceParams = {
  id?: string;
  name: string;
  region: string;
  legalEntity?: string;
  environment?: string;
  integrationMode?: string;
  endpointUrl?: string;
  active?: boolean;
};

export type SaveErpSourceResult =
  | { ok: true; id: string; status: string }
  | { ok: false; status: number; error: string };

/**
 * Direct port of save(): creates or updates an ERP source registration.
 * `department` is always forced to the legacy constant regardless of
 * input, exactly as the source does, since fund classification belongs to
 * individual ERP transactions, not the source registration itself.
 */
export async function saveErpSource(params: SaveErpSourceParams): Promise<SaveErpSourceResult> {
  const name = (params.name ?? "").trim().slice(0, 120);
  const region = (params.region ?? "").trim();
  const legalEntity = (params.legalEntity ?? "").trim().slice(0, 160);
  const environment = (params.environment ?? "Production").trim();
  const integrationMode = (params.integrationMode ?? ERP_INTEGRATION_MODES[0]).trim();
  const endpointUrl = (params.endpointUrl ?? "").trim().slice(0, 500);

  if (!name) return { ok: false, status: 400, error: "Enter a name for this ERP." };
  if (!(ERP_REGIONS as readonly string[]).includes(region)) {
    return {
      ok: false,
      status: 400,
      error:
        "Choose the ERP location: Pakistan, UAE or UK & USA. Fund classification belongs to individual ERP transactions.",
    };
  }
  if (!(ERP_ENVIRONMENTS as readonly string[]).includes(environment)) {
    return { ok: false, status: 400, error: "Choose a valid environment." };
  }
  if (!(ERP_INTEGRATION_MODES as readonly string[]).includes(integrationMode)) {
    return { ok: false, status: 400, error: "Choose a supported integration approach." };
  }
  if (
    endpointUrl &&
    !(
      endpointUrl.startsWith("https://") ||
      endpointUrl.startsWith("http://localhost:") ||
      endpointUrl.startsWith("http://127.0.0.1:")
    )
  ) {
    return {
      ok: false,
      status: 400,
      error: "ERP endpoint must be HTTPS (or local development only). Do not enter SQL passwords.",
    };
  }

  const active = params.active ?? true;

  if (params.id) {
    const existing = await prisma.financeErpSource.findUnique({ where: { id: params.id } });
    if (!existing) return { ok: false, status: 404, error: "ERP source not found." };
    await prisma.financeErpSource.update({
      where: { id: params.id },
      data: {
        name,
        department: LEGACY_DEFAULT_DEPARTMENT,
        legalEntity,
        environment,
        integrationMode,
        endpointUrl,
        active,
        region,
      },
    });
    return { ok: true, id: params.id, status: "Registered, not connected" };
  }

  const created = await prisma.financeErpSource.create({
    data: {
      name,
      department: LEGACY_DEFAULT_DEPARTMENT,
      legalEntity,
      environment,
      integrationMode,
      endpointUrl,
      active,
      region,
    },
  });
  return { ok: true, id: created.id, status: "Registered, not connected" };
}

/**
 * Direct port of require_source(): resolves and validates an active ERP
 * source by id. Used by every inbound staging function below to enforce
 * that a caller always identifies which regional ERP a record came from.
 */
async function requireActiveErpSource(sourceId: string | undefined | null) {
  const id = (sourceId ?? "").trim();
  if (!id) return null;
  const source = await prisma.financeErpSource.findUnique({ where: { id } });
  if (!source || !source.active) return null;
  return source;
}

// --- Inbound payment staging --------------------------------------------

export type StageErpItemsResult =
  | { ok: true; sourceId: string; staged: number; skippedMatched: number; note: string }
  | { ok: false; status: number; error: string };

/**
 * Direct port of stage_erp_items() (server.py lines ~90-106): accepts a
 * batch of inbound ERP payment records into the staging table for manual
 * matching. Re-pushing a record with the same (sourceId, externalId)
 * refreshes it unless it was already matched, in which case it is
 * skipped rather than reopened.
 */
export async function stageErpItems(params: {
  sourceId: string;
  payments: unknown[];
}): Promise<StageErpItemsResult> {
  const { payments } = params;
  if (!Array.isArray(payments) || payments.length < 1 || payments.length > 500) {
    return { ok: false, status: 400, error: "Provide 1 to 500 ERP payment records per batch." };
  }

  const source = await requireActiveErpSource(params.sourceId);
  if (!source) {
    return {
      ok: false,
      status: 400,
      error:
        "Select an active registered ERP source and supply sourceId. This prevents transaction ID collisions between ERPs.",
    };
  }

  let staged = 0;
  let skippedMatched = 0;

  for (const obj of payments) {
    if (typeof obj !== "object" || obj === null) {
      return { ok: false, status: 400, error: "Each record must be an object" };
    }
    const record = obj as Record<string, unknown>;
    const externalId = String(record.erpPaymentId ?? "").trim();
    if (!externalId || externalId.length > 200) {
      return { ok: false, status: 400, error: "Every ERP item requires a unique erpPaymentId" };
    }
    const rawJson = JSON.stringify(record);
    if (rawJson.length > 20000) {
      return { ok: false, status: 400, error: "ERP item exceeds 20 KB" };
    }

    const existing = await prisma.financeErpSyncStaging.findFirst({
      where: { sourceId: source.id, externalId },
    });
    if (existing && existing.status === "matched") {
      skippedMatched++;
      continue;
    }
    if (existing) {
      await prisma.financeErpSyncStaging.update({
        where: { id: existing.id },
        data: { receivedAt: new Date(), rawJson },
      });
    } else {
      await prisma.financeErpSyncStaging.create({
        data: { sourceId: source.id, externalId, rawJson, status: "pending" },
      });
    }
    staged++;
  }

  return {
    ok: true,
    sourceId: source.id,
    staged,
    skippedMatched,
    note: "Payments staged for matching. Existing ledger payments are not changed automatically.",
  };
}

// --- Inbound fund-movement staging ---------------------------------------

export type StageErpFundMovementsResult =
  | { ok: true; sourceId: string; region: string | null; staged: number; duplicatesSkipped: number; note: string }
  | { ok: false; status: number; error: string };

/**
 * Adapted port of stage_erp_fund_movements() (server.py lines ~108-156).
 *
 * SCOPE CUT vs. the source: after validating a movement, the source
 * immediately posts it into the treasury ledger (treasury_ledger /
 * treasury_allocations) against a registered bank account, and does a
 * deep-equality check on re-push to detect and reject a changed
 * duplicate. Treasury posting is a different sub-domain being ported in
 * parallel elsewhere, and FinanceBankAccount/treasury-ledger lookups are
 * out of scope here. This function performs only the ERP-registry half:
 * validate the shape of each inbound movement, enforce the composite
 * (sourceId, externalId) staging discipline via FinanceErpSyncStaging
 * (tagging the payload with a `__kind: "fundMovement"` discriminator so
 * it can be told apart from staged payment records), and queue the raw
 * record for the treasury module to pick up and post. A re-pushed
 * duplicate is simply skipped here rather than compared field-by-field —
 * flagged below in the handback report.
 */
export async function stageErpFundMovements(params: {
  sourceId: string;
  movements: unknown[];
}): Promise<StageErpFundMovementsResult> {
  const { movements } = params;
  if (!Array.isArray(movements) || movements.length < 1 || movements.length > 300) {
    return { ok: false, status: 400, error: "Supply 1 to 300 Finance-tagged ERP fund movements." };
  }

  const source = await requireActiveErpSource(params.sourceId);
  if (!source) {
    return {
      ok: false,
      status: 400,
      error:
        "Select an active registered ERP source and supply sourceId. This prevents transaction ID collisions between ERPs.",
    };
  }
  if (!source.region || source.region === "Unassigned") {
    return { ok: false, status: 400, error: "Set the ERP geographic region before importing Finance fund tags." };
  }

  let staged = 0;
  let duplicatesSkipped = 0;

  for (const item of movements) {
    if (typeof item !== "object" || item === null) {
      return { ok: false, status: 400, error: "Each ERP movement must be a record" };
    }
    const record = item as Record<string, unknown>;
    const externalId = String(record.erpTransactionId ?? "").trim();
    const accountNumber = String(record.erpAccountNumber ?? "").trim();
    if (!externalId || externalId.length > 125 || !accountNumber) {
      return { ok: false, status: 400, error: "Each movement requires a unique erpTransactionId and erpAccountNumber" };
    }
    const allocations = record.fundAllocations;
    if (!Array.isArray(allocations) || allocations.length === 0) {
      return {
        ok: false,
        status: 400,
        error: "Finance must supply fundAllocations for every ERP movement. Use Unallocated when Finance has not assigned ownership.",
      };
    }
    const reviewer = String(record.financeApprovedBy ?? "").trim();
    if (!reviewer) {
      return { ok: false, status: 400, error: "Each movement needs financeApprovedBy from the source ERP" };
    }
    const amount = Number(record.amount);
    if (!Number.isFinite(amount) || Math.abs(amount) < 0.000001) {
      return { ok: false, status: 400, error: "Provide a non-zero signed movement amount" };
    }

    const existing = await prisma.financeErpSyncStaging.findFirst({
      where: { sourceId: source.id, externalId },
    });
    if (existing) {
      duplicatesSkipped++;
      continue;
    }

    await prisma.financeErpSyncStaging.create({
      data: {
        sourceId: source.id,
        externalId,
        rawJson: JSON.stringify({ __kind: "fundMovement", erpAccountNumber: accountNumber, ...record }),
        status: "pending",
      },
    });
    staged++;
  }

  return {
    ok: true,
    sourceId: source.id,
    region: source.region,
    staged,
    duplicatesSkipped,
    note: "Fund tags staged from ERP Finance allocations for treasury review; native currency retained.",
  };
}

// --- Read-only summaries --------------------------------------------------

export type ErpFundSummaryRow = {
  sourceId: string;
  region: string | null;
  sourceName: string;
  currency: string;
  fund: string;
  amount: number;
  movementCount: number;
};

/**
 * Adapted port of erp_fund_summary() (server.py lines ~159-167): the
 * source summarizes already treasury-posted ERP-tagged ledger rows
 * (JOINing treasury_ledger/treasury_allocations). Since this module does
 * not post to treasury (see stageErpFundMovements above), this summarizes
 * the still-pending staged fund movements instead — grouped by source
 * region/name, currency and fund — so Finance can see what's queued for
 * the treasury module to post.
 */
export async function getErpFundSummary(): Promise<ErpFundSummaryRow[]> {
  const staged = await prisma.financeErpSyncStaging.findMany({
    where: { status: "pending" },
    include: { source: true },
  });

  const totals = new Map<string, ErpFundSummaryRow>();

  for (const row of staged) {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(row.rawJson);
    } catch {
      continue;
    }
    if (payload.__kind !== "fundMovement") continue;

    const allocations = Array.isArray(payload.fundAllocations) ? payload.fundAllocations : [];
    const currency = String(payload.currency ?? "").toUpperCase();

    for (const alloc of allocations) {
      if (typeof alloc !== "object" || alloc === null) continue;
      const fund = String((alloc as Record<string, unknown>).fund ?? "");
      const amount = Number((alloc as Record<string, unknown>).amount ?? 0) || 0;
      const key = `${row.sourceId}\u0000${currency}\u0000${fund}`;
      const existing = totals.get(key);
      if (existing) {
        existing.amount += amount;
        existing.movementCount += 1;
      } else {
        totals.set(key, {
          sourceId: row.sourceId,
          region: row.source.region,
          sourceName: row.source.name,
          currency,
          fund,
          amount,
          movementCount: 1,
        });
      }
    }
  }

  return Array.from(totals.values())
    .map((r) => ({ ...r, amount: Math.round(r.amount * 100) / 100 }))
    .sort(
      (a, b) =>
        (a.region ?? "").localeCompare(b.region ?? "") ||
        a.fund.localeCompare(b.fund) ||
        a.currency.localeCompare(b.currency)
    );
}

export type ErpStatus = {
  connected: boolean;
  connector: string;
  unmatched: Awaited<ReturnType<typeof prisma.financeErpSyncStaging.findMany>>;
};

/**
 * Adapted port of erp_status() (server.py lines ~187-190): status/health
 * summary of ERP sources and the staging queue. The source's
 * `incomingApiEnabled` flag reflected a standalone-app environment secret
 * (ERP_SYNC_TOKEN) gating an inbound webhook; there is no equivalent
 * configured in this app yet (no live ingestion endpoint exists at this
 * stage of the port), so that field is omitted here rather than faked.
 */
export async function getErpStatus(): Promise<ErpStatus> {
  const unmatched = await prisma.financeErpSyncStaging.findMany({
    where: { status: "pending" },
    orderBy: { receivedAt: "desc" },
    take: 100,
  });
  return {
    connected: false,
    connector: "Not configured. Requires ERP vendor/API credentials.",
    unmatched,
  };
}

// --- Manual resolution -----------------------------------------------------

export type ResolveErpItemResult = { ok: true; linked: string } | { ok: false; status: number; error: string };

/**
 * Direct port of resolve_erp_item() (server.py lines ~169-185): manually
 * matches a staged ERP record against a real FinanceTransaction, filling
 * in only the payment-trace fields that are currently empty (never
 * clobbering manually reviewed data), then marks the staged record
 * resolved.
 */
export async function resolveErpItem(params: {
  stagedId: string;
  transactionId: string;
}): Promise<ResolveErpItemResult> {
  const stagedId = (params.stagedId ?? "").trim().slice(0, 90);
  const transactionId = (params.transactionId ?? "").trim().slice(0, 150);

  const stage = stagedId ? await prisma.financeErpSyncStaging.findUnique({ where: { id: stagedId } }) : null;
  const tx = transactionId ? await prisma.financeTransaction.findUnique({ where: { id: transactionId } }) : null;
  if (!stage || !tx) {
    return { ok: false, status: 400, error: "Valid staged ERP record and matching existing transaction required" };
  }

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(stage.rawJson);
  } catch {
    obj = {};
  }

  const old = await prisma.financePaymentTrace.findUnique({ where: { transactionId } });
  // Do not silently overwrite any manually reviewed bank/card or subscription traceability.
  if (old && old.reviewed) {
    return { ok: false, status: 409, error: "The payment is already verified. Review any differences manually." };
  }

  const candidate = {
    erpSourceId: stage.sourceId,
    erpPaymentId: String(obj.erpPaymentId ?? "").slice(0, 200),
    paymentReference: String(obj.bankReference ?? "").slice(0, 200),
    erpInvoiceId: String(obj.invoiceReference ?? "").slice(0, 200),
    supplier: String(obj.supplier ?? "").slice(0, 250),
    purpose: String(obj.purpose ?? "").slice(0, 1500),
  };

  if (old) {
    // Only fill fields that are currently empty — mirrors the source's
    // `{k: v for k, v in changes.items() if v and not old[k]}` filter.
    const changes: Record<string, string> = {};
    for (const [key, value] of Object.entries(candidate)) {
      const oldValue = (old as unknown as Record<string, string | null>)[key];
      if (value && !oldValue) changes[key] = value;
    }
    if (Object.keys(changes).length > 0) {
      await prisma.financePaymentTrace.update({ where: { transactionId }, data: changes });
    }
  } else {
    await prisma.financePaymentTrace.create({ data: { transactionId, ...candidate } });
  }

  await prisma.financeErpSyncStaging.update({
    where: { id: stage.id },
    data: { matchedTransactionId: transactionId, status: "matched" },
  });

  return { ok: true, linked: transactionId };
}

// --- Bank balance snapshots -------------------------------------------------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T[0-9:.+-]+Z?)?$/;
const CURRENCY_RE = /^[A-Z]{3}$/;

export type StageBankBalancesResult =
  | { ok: true; upserted: number; note: string }
  | { ok: false; status: number; error: string };

/**
 * Direct port of stage_bank_balances() (server.py lines ~761-777):
 * ingests inbound bank-balance snapshots per external account, keyed by
 * (sourceId + "::" + erpAccountNumber) when a registered ERP source is
 * given, or a legacy free-standing erpAccountId otherwise. Upserts on the
 * compound (externalAccountId, asOf) key.
 */
export async function stageBankBalances(params: { balances: unknown[] }): Promise<StageBankBalancesResult> {
  const { balances } = params;
  if (!Array.isArray(balances) || balances.length < 1 || balances.length > 300) {
    return { ok: false, status: 400, error: "Provide 1 to 300 bank snapshots." };
  }

  type Cleaned = {
    externalAccountId: string;
    asOf: string;
    institution: string;
    accountLabel: string;
    legalEntity: string;
    currency: string;
    ledgerBalance: number;
    availableBalance: number | null;
    erpReference: string;
  };
  const cleaned: Cleaned[] = [];

  for (const x of balances) {
    if (typeof x !== "object" || x === null) {
      return { ok: false, status: 400, error: "Each balance must be an object." };
    }
    const record = x as Record<string, unknown>;
    const sourceId = String(record.sourceId ?? "").trim().slice(0, 80);
    const accountNumber = String(record.erpAccountNumber ?? "").trim().slice(0, 150);
    if (Boolean(sourceId) !== Boolean(accountNumber)) {
      return {
        ok: false,
        status: 400,
        error: "Supply sourceId and erpAccountNumber together, or use legacy erpAccountId.",
      };
    }

    if (sourceId) {
      const source = await prisma.financeErpSource.findUnique({ where: { id: sourceId } });
      if (!source || !source.active) {
        return { ok: false, status: 400, error: "Unknown or inactive ERP source." };
      }
    }

    const externalAccountId = sourceId
      ? `${sourceId}::${accountNumber}`
      : String(record.erpAccountId ?? "").trim().slice(0, 150);
    const asOf = String(record.asOf ?? "").trim().slice(0, 40);
    const currency = String(record.currency ?? "").trim().toUpperCase();
    const ledgerBalance = Number(record.ledgerBalance);
    const availableRaw = record.availableBalance;
    const availableBalance =
      availableRaw === undefined || availableRaw === null || availableRaw === ""
        ? null
        : Number(availableRaw);

    if (!externalAccountId || !ISO_DATE_RE.test(asOf) || !CURRENCY_RE.test(currency) || !Number.isFinite(ledgerBalance)) {
      return { ok: false, status: 400, error: "Each record requires erpAccountId, asOf, ISO currency and ledgerBalance." };
    }

    cleaned.push({
      externalAccountId,
      asOf,
      institution: String(record.institution ?? "").slice(0, 100),
      accountLabel: String(record.accountLabel ?? "").slice(0, 100),
      legalEntity: String(record.legalEntity ?? "").slice(0, 100),
      currency,
      ledgerBalance,
      availableBalance: availableBalance !== null && Number.isFinite(availableBalance) ? availableBalance : null,
      erpReference: String(record.reference ?? "").slice(0, 150),
    });
  }

  for (const row of cleaned) {
    const asOfDate = new Date(row.asOf);
    const existing = await prisma.financeErpBankBalance.findFirst({
      where: { externalAccountId: row.externalAccountId, asOf: asOfDate },
    });
    const data = {
      institution: row.institution || null,
      accountLabel: row.accountLabel || null,
      legalEntity: row.legalEntity || null,
      currency: row.currency,
      ledgerBalance: row.ledgerBalance,
      availableBalance: row.availableBalance,
      erpReference: row.erpReference || null,
      receivedAt: new Date(),
    };
    if (existing) {
      await prisma.financeErpBankBalance.update({ where: { id: existing.id }, data });
    } else {
      await prisma.financeErpBankBalance.create({
        data: { externalAccountId: row.externalAccountId, asOf: asOfDate, ...data },
      });
    }
  }

  return { ok: true, upserted: cleaned.length, note: "These are ERP-sourced balances, not direct bank feed values." };
}

/**
 * Direct port of latest_erp_bank_balances() (server.py lines ~757-759):
 * the most recent balance snapshot per external account.
 */
export async function getLatestErpBankBalances() {
  const all = await prisma.financeErpBankBalance.findMany({ orderBy: { asOf: "desc" } });
  const latestByAccount = new Map<string, (typeof all)[number]>();
  for (const row of all) {
    if (!latestByAccount.has(row.externalAccountId)) latestByAccount.set(row.externalAccountId, row);
  }
  return Array.from(latestByAccount.values()).sort(
    (a, b) =>
      (a.legalEntity ?? "").localeCompare(b.legalEntity ?? "") ||
      (a.institution ?? "").localeCompare(b.institution ?? "") ||
      (a.accountLabel ?? "").localeCompare(b.accountLabel ?? "")
  );
}
