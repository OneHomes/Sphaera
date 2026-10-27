import { PrismaClient, Prisma } from "@prisma/client";
import { AsyncLocalStorage } from "async_hooks";

// Standard Next.js singleton pattern — prevents creating a new PrismaClient
// (and new DB connection pool) on every hot-reload in development.
const globalForPrisma = globalThis as unknown as { prismaBase?: PrismaClient };
const base = globalForPrisma.prismaBase ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaBase = base;
}

// ===========================================================================
// MULTI-TENANCY — automatic organizationId scoping (2026-10-23)
//
// `tenantContext` is set by lib/withTenant.ts at the top of a route/page
// that's been migrated to be tenant-aware. For every query against a
// tenant-scoped model, this extension:
//   - reads/updates/deletes: injects `organizationId` into `where`
//   - creates: injects `organizationId` into `data` (if not already set)
//
// If NO context is set (a route that hasn't been migrated yet), this
// falls back to the "One Homes" organization — the one tenant that's
// existed so far — rather than throwing. That's what makes this an
// incremental, non-breaking rollout: every one of the ~321 existing
// query call sites keeps working exactly as before (because there's
// only been one org, the fallback IS correct for all of them) until its
// route is explicitly wrapped in withTenant(), at which point it
// switches to enforcing the REQUEST's actual organization instead of the
// fallback. See the plan this was built from for the full reasoning.

export const tenantContext = new AsyncLocalStorage<{ organizationId: string }>();

const DEFAULT_ORG_SLUG = "one-homes";
let cachedDefaultOrgId: string | undefined;

async function resolveOrganizationId(): Promise<string> {
  const fromContext = tenantContext.getStore()?.organizationId;
  if (fromContext) return fromContext;
  if (cachedDefaultOrgId) return cachedDefaultOrgId;
  const org = await base.organization.findUniqueOrThrow({ where: { slug: DEFAULT_ORG_SLUG } });
  cachedDefaultOrgId = org.id;
  return org.id;
}

// Every model that gained an organizationId column in the multi-tenancy
// migration (prisma/schema.prisma) — Organization/Subscription/
// OrganizationInvite themselves are deliberately excluded (they're how
// tenants are managed, not tenant-owned data), as are the global
// market-intelligence models (IntelligenceDataset/MarketObservation/
// IndexSeries — shared reference data, not customer data).
const TENANT_SCOPED_MODELS = new Set<Prisma.ModelName>([
  "Lead",
  "LeadNote",
  "LeadTag",
  "TagRemovalRequest",
  "LeadTimelineEvent",
  "Opportunity",
  "Team",
  "User",
  "Project",
  "PaymentPlan",
  "Unit",
  "AexConfig",
  "Playbook",
  "Challenge",
  "JanusFeedback",
  "WhatsAppConfig",
  "WhatsAppNumber",
  "WhatsAppConversation",
  "WhatsAppMessage",
  "AexPointEvent",
  "UserBadge",
  "UserStreak",
  "AuditLog",
  "Document",
  "Task",
  "JournalEntry",
  "MindStateCheckIn",
  "Target",
  "Notification",
  "TeamFocus",
  "GraphToken",
  "DuplicateLeadFlag",
  "JanusConversation",
  "JanusMessage",
  // Sphaera Finance module (2026-10-26) — see prisma/schema.prisma's
  // Finance section comment for the full porting rationale.
  "FinanceTransaction",
  "FinanceAllocation",
  "FinanceLegacyMapping",
  "FinanceManagementDepartment",
  "FinanceManagementCostHead",
  "FinanceCostHead",
  "FinanceMonthly",
  "FinanceImport",
  "FinanceDisputedCharge",
  "FinanceChangeJournal",
  "FinancePaymentSource",
  "FinanceSubscription",
  "FinanceSubscriptionUser",
  "FinancePaymentTrace",
  "FinanceErpSyncStaging",
  "FinancePaymentCostSplit",
  "FinanceOverheadHeadRule",
  "FinanceOverheadPaymentOverride",
  "FinancePerson",
  "FinancePersonCostAllocation",
  "FinancePlan",
  "FinancePlanLine",
  "FinancePlanTarget",
  "FinanceErpBankBalance",
  "FinanceErpSource",
  "FinanceBankAccount",
  "FinanceTreasuryLedger",
  "FinanceTreasuryAllocation",
  "FinanceTreasurySettlement",
  "FinanceCreditInvoice",
  "FinanceCreditRecurring",
  "FinanceCreditCardRule",
  "FinanceCreditCardStatement",
  "FinanceCreditCardCharge",
  "FinanceCreditBankLink",
  "FinanceCreditInvoiceImport",
  "FinanceMerchantBatch",
  "FinanceMerchantReview",
  "FinanceMerchantInvoice",
  "FinanceMerchantInvoiceLink",
  "FinanceMerchantProvider",
  "FinanceMerchantAlias",
  "FinanceDepartmentAccess",
]);

// findUnique/findUniqueOrThrow deliberately excluded: Prisma requires
// their `where` to be exactly a unique selector (id, or a declared
// @unique/@@unique combination) — adding an unrelated organizationId
// field to it is rejected at the query-engine level, unlike findFirst/
// findMany/update/delete, which accept arbitrary extra filter
// conditions. A record's id is already globally unique (cuid), so a
// lookup-by-id doesn't need the extra filter for correctness anyway —
// cross-tenant access-by-guessed-id is a separate, existing concern
// (lib/authz.ts's canAccessRecord) that this migration doesn't change.
const WHERE_FILTERED_OPERATIONS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
]);

export const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!TENANT_SCOPED_MODELS.has(model as Prisma.ModelName)) {
          return query(args);
        }

        const organizationId = await resolveOrganizationId();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const a = args as any;

        if (operation === "create") {
          a.data = { organizationId, ...a.data };
        } else if (operation === "createMany") {
          if (Array.isArray(a.data)) {
            a.data = a.data.map((row: Record<string, unknown>) => ({ organizationId, ...row }));
          }
        } else if (operation === "upsert") {
          // organizationId first, `...where`/`...create` spread after — an
          // explicit organizationId already present in either (e.g. a
          // public route like invites/accept that isn't inside a
          // withTenant() context and names a specific org by hand) wins
          // over the ambient/fallback value, same as `create` below.
          a.where = { organizationId, ...a.where };
          a.create = { organizationId, ...a.create };
        } else if (WHERE_FILTERED_OPERATIONS.has(operation)) {
          a.where = { organizationId, ...a.where };
        }

        return query(a);
      },
    },
  },
});

if (process.env.NODE_ENV !== "production") {
  (globalForPrisma as unknown as { prisma?: typeof prisma }).prisma = prisma;
}
