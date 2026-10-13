import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Phase 1 Sales Scope — Interest Tags. "Sales Consultants can add
// Interest Tags to a lead at any stage of the lead lifecycle... Users
// must be able to add and remove tags without changing the lead stage."
// Only active (non-removed) tags are returned here; removed ones stay
// in the table as history (see GET with ?includeRemoved=1 if ever
// needed for an audit view) but aren't shown as "current" tags.

function normalizeTag(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tags = await prisma.leadTag.findMany({
    where: { leadId: params.id, removedAt: null },
    orderBy: { createdAt: "asc" },
    include: { removalRequests: { where: { status: "pending" } } },
  });

  return NextResponse.json(
    tags.map((t) => ({
      id: t.id,
      tag: t.tag,
      addedByName: t.addedByName,
      createdAt: t.createdAt,
      removalPending: t.removalRequests.length > 0,
    }))
  );
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (!body.tag || typeof body.tag !== "string" || !body.tag.trim()) {
    return NextResponse.json({ error: "tag is required" }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({ where: { id: params.id } });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // A comma-separated entry ("#Rental, #Retire") creates one tag per
  // segment rather than a single tag containing a comma.
  const rawTag = body.tag as string;
  const requestedTags = [...new Set(rawTag.split(",").map(normalizeTag).filter((t: string) => t !== "#"))];
  if (requestedTags.length === 0) {
    return NextResponse.json({ error: "tag is required" }, { status: 400 });
  }

  const existingTags = await prisma.leadTag.findMany({
    where: { leadId: params.id, tag: { in: requestedTags }, removedAt: null },
    select: { tag: true },
  });
  const existingSet = new Set(existingTags.map((t) => t.tag));
  const toCreate = requestedTags.filter((t) => !existingSet.has(t));
  const addedByName = session.user?.name ?? session.user?.email ?? "Unknown";

  if (toCreate.length > 0) {
    await prisma.leadTag.createMany({
      data: toCreate.map((tag) => ({ leadId: params.id, tag, addedByName })),
    });
  }

  const created = await prisma.leadTag.findMany({
    where: { leadId: params.id, tag: { in: toCreate }, removedAt: null },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    {
      created: created.map((t) => ({ id: t.id, tag: t.tag, addedByName: t.addedByName, createdAt: t.createdAt })),
      skipped: requestedTags.filter((t) => existingSet.has(t)),
    },
    { status: 201 }
  );
}
