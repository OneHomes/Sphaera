import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toUiNote } from "@/lib/leadTransform";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { createNotification } from "@/lib/notifications";

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

  const text = body.text.trim();
  const author = await getOrCreateCurrentUser(session);

  const note = await prisma.leadNote.create({
    data: {
      leadId: params.id,
      author: session.user?.name ?? session.user?.email ?? "Unknown",
      text,
    },
  });

  await prisma.leadTimelineEvent.create({
    data: {
      leadId: params.id,
      type: "note",
      summary: text.slice(0, 140),
    },
  });

  // PRD AE17 — @mentions in a note notify the mentioned teammate. Simple
  // name-based match (full name or first name, case-insensitive) against
  // real users — no dedicated syntax/autocomplete yet, just "@Name".
  try {
    const allUsers = await prisma.user.findMany({ select: { id: true, name: true } });
    const lowerText = text.toLowerCase();
    const mentioned = allUsers.filter((u) => {
      if (u.id === author.id) return false;
      const firstName = u.name.split(" ")[0];
      return (
        lowerText.includes(`@${u.name.toLowerCase()}`) ||
        lowerText.includes(`@${firstName.toLowerCase()}`)
      );
    });
    await Promise.all(
      mentioned.map((u) =>
        createNotification(
          u.id,
          "lead_note_mention",
          `${author.name} mentioned you`,
          `${lead.name}: ${text.slice(0, 140)}`,
          `/leads/${params.id}`
        )
      )
    );
  } catch (err) {
    console.error("Mention notification failed:", err);
  }

  return NextResponse.json(toUiNote(note), { status: 201 });
}