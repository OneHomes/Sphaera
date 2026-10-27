import { prisma } from "../prisma";
import { logReversible, revisionItems } from "./changeJournal";

// Payment traceability & subscriptions — ported from the source Python
// app's server.py (trace_state, upsert_payment_source, upsert_subscription,
// subscription_split_preview, save_payment_trace, bulk_subscription_link,
// lines ~811-998). The centerpiece is subscription_split_preview(): a
// penny-exact proportional cost split across departments, computed in
// integer cents with a largest-remainder-method distribution so slices
// always sum back exactly to the source payment — never float-drifted.

export async function getTraceState() {
  const [paymentSources, subscriptions, subscriptionUsers, erpStaging] = await Promise.all([
    prisma.financePaymentSource.findMany({ orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    prisma.financeSubscription.findMany({ orderBy: [{ supplier: "asc" }, { service: "asc" }] }),
    prisma.financeSubscriptionUser.findMany({ orderBy: [{ subscriptionId: "asc" }, { userEmail: "asc" }] }),
    prisma.financeErpSyncStaging.findMany({
      where: { status: "pending" },
      orderBy: { receivedAt: "desc" },
      take: 80,
    }),
  ]);

  return {
    paymentSources,
    subscriptions,
    subscriptionUsers,
    unmatchedErpRecords: erpStaging.length,
    erpStaging,
  };
}

export type MatchErpResult = { ok: true } | { ok: false; status: number; error: string };

/** Direct equivalent of the source's ERP-to-ledger reconciliation pick — links one staged incoming ERP record to an existing transaction. */
export async function matchErpRecord(params: { stagingId: string; transactionId: string }): Promise<MatchErpResult> {
  const staging = await prisma.financeErpSyncStaging.findUnique({ where: { id: params.stagingId } });
  if (!staging) return { ok: false, status: 404, error: "ERP record no longer exists" };
  const tx = await prisma.financeTransaction.findUnique({ where: { id: params.transactionId } });
  if (!tx) return { ok: false, status: 404, error: "Payment no longer exists" };

  await prisma.financeErpSyncStaging.update({
    where: { id: params.stagingId },
    data: { status: "matched", matchedTransactionId: params.transactionId },
  });
  return { ok: true };
}

const PAYMENT_SOURCE_KINDS = ["Bank account", "Company card", "Other"] as const;

export type UpsertResult = { ok: true; id: string } | { ok: false; status: number; error: string };

/** Direct port of upsert_payment_source() — "Never enter full bank or card details," only last 4 digits. */
export async function upsertPaymentSource(body: {
  id?: string;
  name: string;
  kind: string;
  lastFour?: string;
  legalEntity?: string;
  institution?: string;
  currency?: string;
  note?: string;
  active?: boolean;
}): Promise<UpsertResult> {
  const name = (body.name ?? "").trim().slice(0, 120);
  const kind = (body.kind ?? "").trim();
  if (!name || !PAYMENT_SOURCE_KINDS.includes(kind as (typeof PAYMENT_SOURCE_KINDS)[number])) {
    return { ok: false, status: 400, error: "Enter a name and choose bank, card or other." };
  }
  const lastFour = (body.lastFour ?? "").trim();
  if (lastFour && !/^\d{4}$/.test(lastFour)) {
    return {
      ok: false,
      status: 400,
      error: "Only the last four digits are permitted. Never enter full bank or card details.",
    };
  }

  const data = {
    name,
    kind,
    legalEntity: (body.legalEntity ?? "").trim().slice(0, 150) || null,
    institution: (body.institution ?? "").trim().slice(0, 120) || null,
    currency: (body.currency ?? "").trim().slice(0, 5).toUpperCase() || null,
    lastFour: lastFour || null,
    note: (body.note ?? "").trim().slice(0, 1000) || null,
    isActive: body.active === undefined ? true : Boolean(body.active),
  };

  if (body.id) {
    const existing = await prisma.financePaymentSource.findUnique({ where: { id: body.id } });
    if (existing) {
      await prisma.financePaymentSource.update({ where: { id: body.id }, data });
      return { ok: true, id: body.id };
    }
  }
  const created = await prisma.financePaymentSource.create({ data: { id: body.id, ...data } });
  return { ok: true, id: created.id };
}

type SubscriptionUserInput = {
  email: string;
  name?: string;
  team?: string;
  licenceType?: string;
  licenceCost?: number | string | null;
  licenceQuantity?: number;
};

/** Direct port of upsert_subscription() — replaces the full named-licence list on every save. */
export async function upsertSubscription(body: {
  id?: string;
  supplier: string;
  service: string;
  purpose?: string;
  department?: string;
  costHead?: string;
  owner?: string;
  billingCycle?: string;
  expectedAmount?: number | string | null;
  currency?: string;
  renewalDate?: string;
  status?: string;
  vendorReference?: string;
  licenceCount?: number | string | null;
  notes?: string;
  users?: SubscriptionUserInput[];
}): Promise<UpsertResult> {
  const supplier = (body.supplier ?? "").trim().slice(0, 150);
  const service = (body.service ?? "").trim().slice(0, 150);
  if (!supplier || !service) {
    return { ok: false, status: 400, error: "Supplier and actual service/product are required." };
  }

  let licenceCount: number | null = null;
  if (body.licenceCount !== undefined && body.licenceCount !== null && body.licenceCount !== "") {
    licenceCount = Number(body.licenceCount);
    if (!Number.isInteger(licenceCount) || licenceCount < 0 || licenceCount > 1_000_000) {
      return { ok: false, status: 400, error: "Invalid licence quantity" };
    }
  }

  const users = body.users ?? [];
  if (!Array.isArray(users) || users.length > 500) {
    return { ok: false, status: 400, error: "Users must be a list of up to 500 accounts" };
  }

  const approvedDepartments = new Set(
    (await prisma.financeManagementDepartment.findMany({ select: { name: true } })).map((d) => d.name)
  );
  const seen = new Set<string>();
  const cleanUsers: {
    email: string;
    name: string;
    team: string;
    licenceType: string;
    cost: number | null;
    quantity: number;
  }[] = [];

  for (const u of users) {
    const email = (u.email ?? "").trim().toLowerCase();
    const team = (u.team ?? "").trim();
    const fullName = (u.name ?? "").trim().slice(0, 100);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { ok: false, status: 400, error: `Invalid licence email: ${email.slice(0, 80)}` };
    }
    if (seen.has(email)) {
      return { ok: false, status: 400, error: `The same email is entered twice: ${email}` };
    }
    if (team && !approvedDepartments.has(team)) {
      return { ok: false, status: 400, error: `Select an approved department for ${email}` };
    }
    const licenceType = (u.licenceType ?? "").trim().slice(0, 120);
    let cost: number | null = null;
    if (u.licenceCost !== undefined && u.licenceCost !== null && u.licenceCost !== "") {
      const parsed = Number(u.licenceCost);
      if (!Number.isFinite(parsed)) {
        return { ok: false, status: 400, error: `Licence price for ${email} must be a number` };
      }
      cost = Math.round(parsed * 100) / 100;
    }
    const quantity = u.licenceQuantity === undefined ? 1 : Number(u.licenceQuantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
      return { ok: false, status: 400, error: `Licence quantity must be 1 to 1,000 for ${email}` };
    }
    seen.add(email);
    cleanUsers.push({ email, name: fullName, team, licenceType, cost, quantity });
  }

  const data = {
    supplier,
    service,
    purpose: (body.purpose ?? "").trim().slice(0, 500) || null,
    department: (body.department ?? "").trim().slice(0, 100) || null,
    costHead: (body.costHead ?? "").trim().slice(0, 150) || null,
    owner: (body.owner ?? "").trim().slice(0, 150) || null,
    billingCycle: (body.billingCycle ?? "").trim().slice(0, 30) || null,
    expectedAmount:
      body.expectedAmount !== undefined && body.expectedAmount !== null && body.expectedAmount !== ""
        ? Number(body.expectedAmount)
        : null,
    currency: (body.currency ?? "").trim().slice(0, 5).toUpperCase() || null,
    renewalDate: (body.renewalDate ?? "").trim().slice(0, 10) || null,
    status: (body.status ?? "").trim().slice(0, 30) || "Active",
    vendorReference: (body.vendorReference ?? "").trim().slice(0, 160) || null,
    licenceCount,
    notes: (body.notes ?? "").trim().slice(0, 1500) || null,
  };

  let subscriptionId = body.id;
  if (subscriptionId) {
    const existing = await prisma.financeSubscription.findUnique({ where: { id: subscriptionId } });
    if (existing) {
      await prisma.financeSubscription.update({ where: { id: subscriptionId }, data });
    } else {
      const created = await prisma.financeSubscription.create({ data: { id: subscriptionId, ...data } });
      subscriptionId = created.id;
    }
  } else {
    const created = await prisma.financeSubscription.create({ data });
    subscriptionId = created.id;
  }

  await prisma.financeSubscriptionUser.deleteMany({ where: { subscriptionId } });
  if (cleanUsers.length > 0) {
    await prisma.financeSubscriptionUser.createMany({
      data: cleanUsers.map((u) => ({
        subscriptionId: subscriptionId!,
        userEmail: u.email,
        userName: u.name || null,
        team: u.team || null,
        licenceType: u.licenceType || null,
        licenceCost: u.cost,
        licenceQuantity: u.quantity,
      })),
    });
  }

  return { ok: true, id: subscriptionId };
}

export type SplitSlice = { department: string; costHead: string; amountUsd: number; licences: number; licenceWeight: number };

export type SplitPreviewResult =
  | {
      ok: true;
      subscriptionId: string;
      service: string;
      costHead: string;
      licences: number;
      seatCounts: Record<string, number>;
      seatWeights: Record<string, number>;
      allocationMethod: "price-weighted" | "equal-seat";
      licenceCurrency: string;
      linkedPayments: number;
      eligiblePayments: number;
      excludedHistorical: number;
      alreadyApproved: number;
      totalUsd: number;
      samplePayment: { id: string; month: string; amountUsd: number; slices: SplitSlice[] };
      departmentTotals: Record<string, number>;
      changeId?: string;
      approvedPayments?: number;
    }
  | { ok: false; status: number; error: string };

/**
 * Direct port of subscription_split_preview() — the penny-exact
 * proportional cost split. Every dollar amount is worked in integer
 * cents; the remainder left over after integer division is handed out
 * one cent at a time to the departments with the largest fractional
 * remainder (largest-remainder / Hamilton apportionment method), so the
 * slices always sum back to EXACTLY the source payment's cents — never a
 * cent short or over due to rounding. `apply: false` (the default) only
 * computes and returns the preview; `apply: true` writes
 * FinancePaymentCostSplit rows and an undoable change-journal entry.
 */
export async function subscriptionSplitPreview(params: {
  subscriptionId: string;
  replaceExisting?: boolean;
  apply?: boolean;
  actorId: string;
  actorEmail: string;
}): Promise<SplitPreviewResult> {
  const sub = await prisma.financeSubscription.findUnique({ where: { id: params.subscriptionId } });
  if (!sub) return { ok: false, status: 404, error: "Subscription does not exist." };

  const costHead = (sub.costHead ?? "").trim();
  const availableHeads = new Set(
    (await prisma.financeManagementCostHead.findMany({ select: { name: true } })).map((h) => h.name)
  );
  if (!costHead || !availableHeads.has(costHead)) {
    return {
      ok: false,
      status: 400,
      error: "First select an approved cost head for this subscription (e.g. Software & Subscriptions).",
    };
  }

  const departments = new Set(
    (await prisma.financeManagementDepartment.findMany({ select: { name: true } })).map((d) => d.name)
  );
  const users = await prisma.financeSubscriptionUser.findMany({
    where: { subscriptionId: params.subscriptionId },
    orderBy: { userEmail: "asc" },
  });
  if (users.length === 0) {
    return { ok: false, status: 400, error: "IT must list the named email licences before calculating a split." };
  }
  const missing = users.filter((u) => !u.team || !departments.has(u.team)).map((u) => u.userEmail);
  if (missing.length > 0) {
    return {
      ok: false,
      status: 400,
      error: `IT must tag every licence to an approved department: ${missing.slice(0, 6).join(", ")}`,
    };
  }

  const counts: Record<string, number> = {};
  for (const u of users) {
    const team = u.team!;
    counts[team] = (counts[team] ?? 0) + (u.licenceQuantity ?? 1);
  }

  const priced = users.filter((u) => u.licenceCost !== null);
  if (priced.length > 0 && priced.length !== users.length) {
    return {
      ok: false,
      status: 400,
      error:
        "Price every named licence, including free licences at 0, before using a price-weighted split. Leaving all prices blank retains the legacy equal-seat split.",
    };
  }
  const pricedMethod = priced.length > 0;

  const weightsCents: Record<string, number> = {};
  for (const u of users) {
    const team = u.team!;
    const unitPriceCents = pricedMethod ? Math.round((u.licenceCost ?? 0) * 100) : 100;
    weightsCents[team] = (weightsCents[team] ?? 0) + unitPriceCents * (u.licenceQuantity ?? 1);
  }
  const totalWeight = Object.values(weightsCents).reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) {
    return { ok: false, status: 400, error: "The total licence cost is zero; enter at least one paid licence." };
  }

  const paymentRows = await prisma.financePaymentTrace.findMany({
    where: { subscriptionId: params.subscriptionId },
    include: { transaction: { include: { allocation: true, paymentCostSplit: true } } },
  });
  const eligible = paymentRows.filter((p) => (p.transaction.allocation?.debtPeriod ?? "current") === "current");
  if (eligible.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "No current operating payments are linked to this subscription. Link the real supplier payment first.",
    };
  }

  const approvedCount = eligible.filter((p) => p.transaction.paymentCostSplit).length;
  const replace = Boolean(params.replaceExisting);
  if (params.apply && approvedCount > 0 && !replace) {
    return {
      ok: false,
      status: 409,
      error: `${approvedCount} linked payments have an approved split. Tick Replace existing approvals only if Finance intends to update them.`,
    };
  }
  if (params.apply && eligible.length > 5000) {
    return { ok: false, status: 400, error: "Maximum 5,000 payments per approval." };
  }

  // Largest-remainder apportionment in integer cents — this is the exact
  // mechanism that guarantees slices always sum back to the payment's
  // real amount, cent for cent.
  function lineAmounts(amountUsd: number): SplitSlice[] {
    const amountCents = Math.round(amountUsd * 100);
    const sign = amountCents >= 0 ? 1 : -1;
    const absolute = Math.abs(amountCents);

    const paid: Record<string, number> = {};
    const remainders: Record<string, number> = {};
    for (const [dept, weight] of Object.entries(weightsCents)) {
      const exact = (absolute * weight) / totalWeight;
      const whole = Math.floor(exact);
      paid[dept] = whole;
      remainders[dept] = exact - whole;
    }
    const distributed = Object.values(paid).reduce((a, b) => a + b, 0);
    let remainder = absolute - distributed;
    const order = Object.keys(paid).sort((a, b) => (remainders[b] - remainders[a]) || a.localeCompare(b));
    for (const dept of order) {
      if (remainder <= 0) break;
      paid[dept] += 1;
      remainder -= 1;
    }

    return Object.keys(paid)
      .sort()
      .map((dept) => ({
        department: dept,
        costHead,
        amountUsd: Math.round(((sign * paid[dept]) / 100) * 100) / 100,
        licences: counts[dept],
        licenceWeight: Math.round((weightsCents[dept] / 100) * 100) / 100,
      }));
  }

  const sample = lineAmounts(eligible[0].transaction.amountUsd);
  const items: { paymentId: string; month: string; amountUsd: number; slices: SplitSlice[] }[] = [];
  for (const p of eligible) {
    const slices = lineAmounts(p.transaction.amountUsd);
    const reconciled = slices.reduce((sum, s) => sum + Math.round(s.amountUsd * 100), 0);
    if (reconciled !== Math.round(p.transaction.amountUsd * 100)) {
      return { ok: false, status: 500, error: "Cost split did not reconcile to payment" };
    }
    items.push({ paymentId: p.transactionId, month: p.transaction.month, amountUsd: p.transaction.amountUsd, slices });
  }

  const departmentTotals: Record<string, number> = {};
  for (const dept of Object.keys(counts)) {
    departmentTotals[dept] =
      Math.round(
        items.reduce((sum, item) => sum + (item.slices.find((s) => s.department === dept)?.amountUsd ?? 0), 0) * 100
      ) / 100;
  }

  const result: SplitPreviewResult = {
    ok: true,
    subscriptionId: params.subscriptionId,
    service: sub.service,
    costHead,
    licences: users.length,
    seatCounts: counts,
    seatWeights: Object.fromEntries(Object.entries(weightsCents).map(([k, v]) => [k, Math.round(v) / 100])),
    allocationMethod: pricedMethod ? "price-weighted" : "equal-seat",
    licenceCurrency: sub.currency || "Supplier currency",
    linkedPayments: paymentRows.length,
    eligiblePayments: eligible.length,
    excludedHistorical: paymentRows.length - eligible.length,
    alreadyApproved: approvedCount,
    totalUsd: Math.round(eligible.reduce((sum, p) => sum + p.transaction.amountUsd, 0) * 100) / 100,
    samplePayment: {
      id: eligible[0].transactionId,
      month: eligible[0].transaction.month,
      amountUsd: eligible[0].transaction.amountUsd,
      slices: sample,
    },
    departmentTotals,
  };

  if (!params.apply) return result;

  const ids = items.map((i) => i.paymentId);
  const before = await revisionItems("FinancePaymentCostSplit", ids);
  const seatSnapshot = users.map((u) => ({
    email: u.userEmail,
    department: u.team,
    licenceType: u.licenceType || "",
    unitCost: u.licenceCost,
    quantity: u.licenceQuantity ?? 1,
    currency: sub.currency,
  }));

  for (const item of items) {
    await prisma.financePaymentCostSplit.upsert({
      where: { transactionId: item.paymentId },
      create: {
        transactionId: item.paymentId,
        subscriptionId: params.subscriptionId,
        breakdownJson: JSON.stringify(item.slices),
        seatSnapshotJson: JSON.stringify(seatSnapshot),
        sourceAmountUsd: item.amountUsd,
        licenceCount: users.length,
        costHead,
        approvedBy: params.actorEmail,
        approvedAt: new Date(),
      },
      update: {
        subscriptionId: params.subscriptionId,
        breakdownJson: JSON.stringify(item.slices),
        seatSnapshotJson: JSON.stringify(seatSnapshot),
        sourceAmountUsd: item.amountUsd,
        licenceCount: users.length,
        costHead,
        approvedBy: params.actorEmail,
        approvedAt: new Date(),
      },
    });
  }

  const after = await revisionItems("FinancePaymentCostSplit", ids);
  const changeId = await logReversible({
    organizationId: sub.organizationId,
    action: "shared_subscription_allocation",
    description: `${ids.length} ${sub.service} payment(s) split across ${Object.keys(counts).length} departments`,
    actorId: params.actorId,
    actorEmail: params.actorEmail,
    before,
    after,
  });

  result.changeId = changeId;
  result.approvedPayments = ids.length;
  return result;
}

const PAYMENT_METHODS = ["Unknown", "Bank transfer", "Company card", "Other"] as const;

export type SaveTraceResult = { ok: true } | { ok: false; status: number; error: string };

/** Direct port of save_payment_trace(). */
export async function savePaymentTrace(body: {
  transactionId: string;
  paymentReference?: string;
  erpPaymentId?: string;
  invoiceReference?: string;
  supplier?: string;
  purpose?: string;
  paymentMethod?: string;
  paymentSourceId?: string;
  subscriptionId?: string;
  sourceCurrency?: string;
  sourceAmount?: number | string | null;
  traceReviewed?: boolean;
}): Promise<SaveTraceResult> {
  const transactionId = (body.transactionId ?? "").trim();
  const paymentMethod = (body.paymentMethod ?? "").trim() || "Unknown";
  if (!PAYMENT_METHODS.includes(paymentMethod as (typeof PAYMENT_METHODS)[number])) {
    return { ok: false, status: 400, error: "Invalid payment method" };
  }

  const tx = await prisma.financeTransaction.findUnique({ where: { id: transactionId } });
  if (!tx) return { ok: false, status: 404, error: "Payment no longer exists" };

  const paymentSourceId = (body.paymentSourceId ?? "").trim() || null;
  if (paymentSourceId) {
    const src = await prisma.financePaymentSource.findUnique({ where: { id: paymentSourceId } });
    if (!src) return { ok: false, status: 400, error: "Select a registered company account or card" };
    if (
      (paymentMethod === "Company card" && src.kind !== "Company card") ||
      (paymentMethod === "Bank transfer" && src.kind !== "Bank account")
    ) {
      return { ok: false, status: 400, error: "Payment method must match the selected source type" };
    }
  }

  const subscriptionId = (body.subscriptionId ?? "").trim() || null;
  if (subscriptionId) {
    const sub = await prisma.financeSubscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) return { ok: false, status: 400, error: "Invalid subscription" };
  }

  const existingSplit = await prisma.financePaymentCostSplit.findUnique({ where: { transactionId } });
  if (existingSplit && subscriptionId !== existingSplit.subscriptionId) {
    return {
      ok: false,
      status: 409,
      error: "Undo the existing shared-cost split in Change History before relinking this payment.",
    };
  }

  const data = {
    paymentReference: (body.paymentReference ?? "").trim().slice(0, 200) || null,
    erpPaymentId: (body.erpPaymentId ?? "").trim().slice(0, 200) || null,
    erpInvoiceId: (body.invoiceReference ?? "").trim().slice(0, 200) || null,
    supplier: (body.supplier ?? "").trim().slice(0, 250) || null,
    purpose: (body.purpose ?? "").trim().slice(0, 1500) || null,
    paymentMethod,
    paymentSourceId,
    subscriptionId,
    sourceCurrency: (body.sourceCurrency ?? "").trim().slice(0, 6).toUpperCase() || null,
    sourceAmount:
      body.sourceAmount !== undefined && body.sourceAmount !== null && body.sourceAmount !== ""
        ? Number(body.sourceAmount)
        : null,
    reviewed: Boolean(body.traceReviewed),
  };

  await prisma.financePaymentTrace.upsert({
    where: { transactionId },
    create: { transactionId, ...data },
    update: data,
  });

  return { ok: true };
}

export type BulkLinkResult = { ok: true; linked: number } | { ok: false; status: number; error: string };

/** Direct port of bulk_subscription_link(). */
export async function bulkSubscriptionLink(params: {
  ids: string[];
  subscriptionId: string;
}): Promise<BulkLinkResult> {
  const { ids, subscriptionId } = params;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 1000 || new Set(ids).size !== ids.length) {
    return { ok: false, status: 400, error: "Select 1 to 1000 payments" };
  }
  const sub = await prisma.financeSubscription.findUnique({ where: { id: subscriptionId } });
  if (!sub) return { ok: false, status: 400, error: "Select a subscription" };

  for (const id of ids) {
    const tx = await prisma.financeTransaction.findUnique({ where: { id } });
    if (!tx) return { ok: false, status: 400, error: "Unknown payment in selection" };
    const split = await prisma.financePaymentCostSplit.findUnique({ where: { transactionId: id } });
    if (split && split.subscriptionId !== subscriptionId) {
      return {
        ok: false,
        status: 409,
        error: "Undo the shared-cost allocation for a payment before moving it to another subscription.",
      };
    }
  }

  let changed = 0;
  for (const id of ids) {
    await prisma.financePaymentTrace.upsert({
      where: { transactionId: id },
      create: { transactionId: id, subscriptionId },
      update: { subscriptionId },
    });
    changed++;
  }

  return { ok: true, linked: changed };
}
