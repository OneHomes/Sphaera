import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toUiLead } from "@/lib/leadTransform";
import { getFreshAuthUser, getLeadScopeWhere } from "@/lib/authz";
import { releaseExpiredLocks } from "@/lib/leadLocks";
import {
  LEADS_PAGE_SIZE,
  parseLeadFilterParams,
  buildLeadFilterWhere,
} from "@/lib/leadFilterQuery";
import { LeadInbox } from "@/components/leads/LeadInbox";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  const authUser = await getFreshAuthUser(session);

  await releaseExpiredLocks();

  const filters = parseLeadFilterParams(searchParams);
  const scopeWhere = getLeadScopeWhere(authUser);
  // 2026-10-15 — this page used to pull every Lead row (unbounded
  // findMany) and filter/paginate it in the browser. That was fine at
  // ~2,000 rows; at ~194,000 (post HubSpot bulk import) it meant
  // fetching, serializing, and shipping the entire table on every load,
  // which is what made /leads hang. Filtering and pagination both now
  // happen in the database query instead — see lib/leadFilterQuery.ts,
  // shared with /api/leads's CSV export so the two can't drift.
  const where = { AND: [scopeWhere, ...buildLeadFilterWhere(filters)] };

  const [leadRows, totalCount, assignableUsers, marketRows, projectRows] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { score: "desc" },
      include: { assignedUser: true, tags: { where: { removedAt: null } } },
      take: LEADS_PAGE_SIZE,
      skip: (filters.page - 1) * LEADS_PAGE_SIZE,
    }),
    prisma.lead.count({ where }),
    // PRD AV05 — manager/admin reassignment target list. Agents don't
    // need this (they can only claim leads for themselves).
    authUser.role === "AGENT"
      ? Promise.resolve([])
      : prisma.user.findMany({
          where: {
            role: "AGENT",
            ...(authUser.role === "MANAGER" && authUser.teamId
              ? { teamId: authUser.teamId }
              : {}),
          },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
    // Facet lists for the Market/Project filter dropdowns — scoped to
    // what this user can see, but independent of their *other* active
    // filters (same behaviour as before, when these were derived from
    // the full in-memory list). Distinct-on-an-indexed-column instead of
    // deriving from loaded rows, since there's no longer a full loaded
    // list to derive them from.
    prisma.lead.findMany({
      where: scopeWhere,
      distinct: ["market"],
      select: { market: true },
      orderBy: { market: "asc" },
    }),
    prisma.lead.findMany({
      where: scopeWhere,
      distinct: ["projectInterest"],
      select: { projectInterest: true },
      orderBy: { projectInterest: "asc" },
    }),
  ]);

  const leads = leadRows.map(toUiLead);

  return (
    <LeadInbox
      initialLeads={leads}
      currentUserId={authUser.id}
      isManagementView={authUser.role !== "AGENT"}
      assignableUsers={assignableUsers}
      canExportData={authUser.canExportData}
      markets={marketRows.map((r) => r.market)}
      projects={projectRows.map((r) => r.projectInterest)}
      totalCount={totalCount}
      page={filters.page}
      pageSize={LEADS_PAGE_SIZE}
    />
  );
}
