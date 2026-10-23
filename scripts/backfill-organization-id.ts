import { prisma } from "../lib/prisma";

// One-time backfill for the multi-tenancy foundation (2026-10-23) —
// every table just gained a nullable `organizationId` column. This
// creates the "One Homes" Organization (the only tenant that's existed
// so far) and sets organizationId on every existing row across every
// tenant-scoped table to that org's id. Safe to re-run: upserts the
// Organization by slug, and each updateMany only touches rows where
// organizationId is still null.

const ONE_HOMES_SLUG = "one-homes";
const ONE_HOMES_NAME = "One Homes";

// Every tenant-scoped Prisma model, in no particular order (none of
// these updateMany calls depend on another's result).
const MODELS = [
  "lead",
  "leadNote",
  "leadTag",
  "tagRemovalRequest",
  "leadTimelineEvent",
  "opportunity",
  "team",
  "user",
  "project",
  "paymentPlan",
  "unit",
  "aexConfig",
  "playbook",
  "challenge",
  "janusFeedback",
  "janusConversation",
  "janusMessage",
  "whatsAppConfig",
  "whatsAppNumber",
  "whatsAppConversation",
  "whatsAppMessage",
  "aexPointEvent",
  "userBadge",
  "userStreak",
  "auditLog",
  "document",
  "task",
  "journalEntry",
  "mindStateCheckIn",
  "target",
  "notification",
  "teamFocus",
  "graphToken",
  "duplicateLeadFlag",
] as const;

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: ONE_HOMES_SLUG },
    create: { slug: ONE_HOMES_SLUG, name: ONE_HOMES_NAME },
    update: {},
  });
  console.log(`Organization "${org.name}" (${org.id}) ready.`);

  await prisma.subscription.upsert({
    where: { organizationId: org.id },
    create: { organizationId: org.id, plan: "enterprise", status: "active" },
    update: {},
  });
  console.log("Subscription row ready (plan: enterprise, status: active).");

  for (const model of MODELS) {
    // Dynamic model access — every model in MODELS has an
    // `organizationId` column (just added in the schema push) and an
    // `updateMany` method, which is all that's used here. TypeScript
    // can't type-check a dynamic union of 31 different updateMany
    // signatures, hence the `any`.
    const client = (prisma as unknown as Record<string, { updateMany: (args: unknown) => Promise<{ count: number }> }>)[model];
    const result = await client.updateMany({
      where: { organizationId: null },
      data: { organizationId: org.id },
    });
    console.log(`${model}: backfilled ${result.count} rows`);
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
