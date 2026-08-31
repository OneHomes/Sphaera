import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";

const patchableFields = ["title", "completed", "dueAt"] as const;

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getOrCreateCurrentUser(session);
  const existing = await prisma.task.findUnique({ where: { id: params.id } });

  if (!existing) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (existing.assignedToId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};
  for (const field of patchableFields) {
    if (field in body) {
      data[field] = field === "dueAt" && body[field] ? new Date(body[field]) : body[field];
    }
  }

  const updated = await prisma.task.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json(updated);
}