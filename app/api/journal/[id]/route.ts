import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";

const patchableFields = ["title", "body", "folder"] as const;

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getOrCreateCurrentUser(session);
  const existing = await prisma.journalEntry.findUnique({
    where: { id: params.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
  // No Manager/Admin override — author-only, always.
  if (existing.authorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};
  for (const field of patchableFields) {
    if (field in body) data[field] = body[field];
  }
  // Favorite/Archive/Trash are booleans over the wire — translated here
  // into the timestamp columns Prisma actually stores, so the client
  // never has to construct a Date itself.
  if ("isFavorite" in body) data.isFavorite = Boolean(body.isFavorite);
  if ("archived" in body) data.archivedAt = body.archived ? new Date() : null;
  if ("trashed" in body) data.deletedAt = body.trashed ? new Date() : null;

  const updated = await prisma.journalEntry.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getOrCreateCurrentUser(session);
  const existing = await prisma.journalEntry.findUnique({
    where: { id: params.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
  if (existing.authorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.journalEntry.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}