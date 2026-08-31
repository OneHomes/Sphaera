import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { getAuthUser, hasRole } from "@/lib/authz";
import { createNotification } from "@/lib/notifications";
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getOrCreateCurrentUser(session);

  const tasks = await prisma.task.findMany({
    where: { assignedToId: user.id },
    orderBy: [{ completed: "asc" }, { dueAt: "asc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authUser = getAuthUser(session);
  const user = await getOrCreateCurrentUser(session);
  const body = await request.json();

  if (!body.title || !body.title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  // A Manager/Admin can assign a task to a teammate (source becomes
  // "Manager assigned"); anyone else can only create tasks for
  // themselves, regardless of what assignedToId they send.
  let assignedToId = user.id;
  let source = body.source && body.source === "Manager assigned"
    ? "Manager assigned"
    : "User created";

  if (
    body.assignedToId &&
    body.assignedToId !== user.id &&
    hasRole(authUser, ["MANAGER", "ADMIN"])
  ) {
    assignedToId = body.assignedToId;
    source = "Manager assigned";
  }

    const task = await prisma.task.create({
    data: {
      title: body.title.trim(),
      relatedTo: body.relatedTo || null,
      leadId: body.leadId || null,
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
      source,
      assignedToId,
      createdById: user.id,
    },
  });

  if (source === "Manager assigned" && assignedToId !== user.id) {
    await createNotification(
      assignedToId,
      "task_assigned",
      "New task assigned",
      task.title,
      "/tasks"
    );
  }

  return NextResponse.json(task, { status: 201 });
}