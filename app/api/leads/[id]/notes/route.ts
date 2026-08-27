import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toUiNote } from "@/lib/leadTransform";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notes = await prisma.leadNote.findMany({
    where: { leadId: params.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(notes.map(toUiNote));
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
  if (!body.text || typeof body.text !== "string" || !body.text.trim()) {
    return NextResponse.json(
      { error: "Note text is required" },
      { status: 400 }
    );
  }

  const lead = await prisma.lead.findUnique({ where: { id: params.id } });
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const note = await prisma.leadNote.create({
    data: {
      leadId: params.id,
      author: session.user?.name ?? session.user?.email ?? "Unknown",
      text: body.text.trim(),
    },
  });

  await prisma.leadTimelineEvent.create({
    data: {
      leadId: params.id,
      type: "note",
      summary: body.text.trim().slice(0, 140),
    },
  });

  return NextResponse.json(toUiNote(note), { status: 201 });
}