import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toUiOpportunity } from "@/lib/opportunityTransform";
import { getOpportunityScopeWhere } from "@/lib/authz";
import { logAudit } from "@/lib/auditLog";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

export async function GET(request: Request) {
  try {
    return await withTenant(async (authUser) => {
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
    }, { fresh: false });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

export async function POST(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
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

      await logAudit({
        actorId: authUser.id,
        actorEmail: session.user?.email ?? "unknown",
        action: "opportunity_created",
        targetId: opportunity.id,
        details: `Created opportunity "${opportunity.leadName}" ($${opportunity.value.toLocaleString()})`,
      });

      return NextResponse.json(toUiOpportunity(opportunity), { status: 201 });
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
