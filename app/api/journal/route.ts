import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";

// PRD 4.10 / 19.5 — Journal entries are strictly private to their
// author. Unlike Lead/Opportunity, there is deliberately NO
// Manager/Admin override anywhere in this file — every query is always
// scoped to the signed-in user's own authorId, full stop.

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getOrCreateCurrentUser(session);

  const entries = await prisma.journalEntry.findMany({
    where: { authorId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(entries);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getOrCreateCurrentUser(session);
  const body = await request.json();

  if (!body.title || !body.title.trim() || !body.body) {
    return NextResponse.json(
      { error: "title and body are required" },
      { status: 400 }
    );
  }

  const entry = await prisma.journalEntry.create({
    data: {
      authorId: user.id,
      folder: body.folder || "Work",
      title: body.title.trim(),
      body: body.body,
    },
  });

  return NextResponse.json(entry, { status: 201 });
}