import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toUiLead } from "@/lib/leadTransform";
import { getFreshAuthUser, getLeadScopeWhere } from "@/lib/authz";
import { releaseExpiredLocks } from "@/lib/leadLocks";
import { generateUniqueLeadUid } from "@/lib/leadUid";
import { flagDuplicatesForLead } from "@/lib/duplicateDetection";
import { LEADS_PAGE_SIZE, buildLeadFilterWhere, parseLeadFilterParamsFromUrl } from "@/lib/leadFilterQuery";
import { toCsv, csvResponse } from "@/lib/csv";

// Shares its filtering logic with app/(app)/leads/page.tsx (both go
// through lib/leadFilterQuery.ts) so the leads list and its CSV export
// can never disagree on what matches. ?format=csv exports the full
// matching set (uncapped, same as the audit log's export) instead of the
// normal paginated JSON page — this is the ONLY place that still needs
// an unbounded query, and it's gated on canExportData same as every
// other export surface.
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authUser = await getFreshAuthUser(session);
  await releaseExpiredLocks();
  const url = new URL(request.url);
  const filters = parseLeadFilterParamsFromUrl(url);
  const isExport = url.searchParams.get("format") === "csv";

  if (isExport && !authUser.canExportData) {
    return NextResponse.json(
      { error: "You don't have export rights. Ask an admin to grant them." },
      { status: 403 }
    );
  }

  const where = { AND: [getLeadScopeWhere(authUser), ...buildLeadFilterWhere(filters)] };

  const leads = await prisma.lead.findMany({
    where,
    orderBy: { score: "desc" },
    include: { assignedUser: true, tags: { where: { removedAt: null } } },
    ...(isExport ? {} : { take: LEADS_PAGE_SIZE, skip: (filters.page - 1) * LEADS_PAGE_SIZE }),
  });

  const uiLeads = leads.map(toUiLead);

  if (isExport) {
    const csv = toCsv(uiLeads, [
      { key: "name", label: "Name" },
      { key: "contact", label: "Contact" },
      { key: "email", label: "Email" },
      { key: "source", label: "Source" },
      { key: "market", label: "Market" },
      { key: "projectInterest", label: "Project" },
      { key: "stage", label: "Stage" },
      { key: "score", label: "Score" },
      { key: "engagement", label: "Engagement" },
      { key: "priority", label: "Priority" },
      { key: "nextActionDue", label: "Next Action Due" },
      { key: "assignment", label: "Assignment" },
      { key: "assignedUserName", label: "Owner" },
    ]);
    return csvResponse(csv, `sphaera-leads-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return NextResponse.json(uiLeads);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (!body.name || !body.contact || !body.source) {
    return NextResponse.json(
      { error: "name, contact, and source are required" },
      { status: 400 }
    );
  }

  const uid = await generateUniqueLeadUid();

  const lead = await prisma.lead.create({
    data: {
      uid,
      name: body.name,
      contact: body.contact,
      source: body.source,
      market: body.market ?? "UK",
      projectInterest: body.projectInterest ?? "",
      stage: body.stage ?? "New",
      score: body.score ?? 0,
      engagement: body.engagement ?? "Low",
      priority: body.priority ?? "Medium",
      assignment: body.assignment ?? "Unassigned",
      prioritizationReason:
        body.prioritizationReason ?? "New lead -- no scoring signal yet",
    },
  });

  await prisma.leadTimelineEvent.create({
    data: {
      leadId: lead.id,
      type: "stage_change",
      summary: `Lead created from ${lead.source}`,
    },
  });

  await flagDuplicatesForLead(lead.id, lead.contact, lead.name);

  return NextResponse.json(toUiLead(lead), { status: 201 });
}