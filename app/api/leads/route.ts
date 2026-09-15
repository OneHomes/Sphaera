import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toUiLead } from "@/lib/leadTransform";
import { getAuthUser, getLeadScopeWhere } from "@/lib/authz";
import { releaseExpiredLocks } from "@/lib/leadLocks";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authUser = getAuthUser(session);
  await releaseExpiredLocks();
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");

  const leads = await prisma.lead.findMany({
    where: {
      AND: [
        getLeadScopeWhere(authUser),
        search ? { name: { contains: search } } : {},
      ],
    },
    orderBy: { score: "desc" },
    include: { assignedUser: true },
  });

  return NextResponse.json(leads.map(toUiLead));
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

  const lead = await prisma.lead.create({
    data: {
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

  return NextResponse.json(toUiLead(lead), { status: 201 });
}