import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toUiOpportunity } from "@/lib/opportunityTransform";
import { getAuthUser, getOpportunityScopeWhere } from "@/lib/authz";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authUser = getAuthUser(session);

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");

  const opportunities = await prisma.opportunity.findMany({
    where: {
      AND: [
        getOpportunityScopeWhere(authUser),
        search ? { leadName: { contains: search } } : {},
      ],
    },
    orderBy: { value: "desc" },
    include: { assignedUser: true },
  });

  return NextResponse.json(opportunities.map(toUiOpportunity));
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (!body.leadName || !body.contact || typeof body.value !== "number") {
    return NextResponse.json(
      { error: "leadName, contact, and value are required" },
      { status: 400 }
    );
  }

  const opportunity = await prisma.opportunity.create({
    data: {
      leadName: body.leadName,
      contact: body.contact,
      value: body.value,
      probability: body.probability ?? 25,
      projectInterest: body.projectInterest ?? "",
      nextAction: body.nextAction ?? "First contact",
      stage: body.stage ?? "New",
      leadId: body.leadId ?? null,
    },
  });

  return NextResponse.json(toUiOpportunity(opportunity), { status: 201 });
}