import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { hasRole } from "@/lib/authz";
import { createNotification } from "@/lib/notifications";
import { recordJanusAction } from "@/lib/janusPolicy";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";
export async function GET(request: Request) {
  try {
    return await withTenant(async (authUser, session) => {
      const user = await getOrCreateCurrentUser(session);
      const { searchParams } = new URL(request.url);
      const search = searchParams.get("search");

      const tasks = await prisma.task.findMany({
        where: {
          AND: [
            { assignedToId: user.id },
            search ? { title: { contains: search } } : {},
          ],
        },
        orderBy: [{ completed: "asc" }, { dueAt: "asc" }],
      });

      return NextResponse.json(tasks);
    });
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
      const user = await getOrCreateCurrentUser(session);
      const body = await request.json();

      if (!body.title || !body.title.trim()) {
        return NextResponse.json({ error: "title is required" }, { status: 400 });
      }

      // A Manager/Admin can assign a task to a teammate (source becomes
      // "Manager assigned"); anyone else can only create tasks for
      // themselves, regardless of what assignedToId they send. "Janus
      // proposed" (PRD JN09) is self-assigned only — the user is always the
      // one confirming Janus's suggestion, never assigning it to someone
      // else, so it doesn't go through the manager-assignment branch below.
      let assignedToId = user.id;
      let source =
        body.source === "Manager assigned"
          ? "Manager assigned"
          : body.source === "Janus proposed"
            ? "Janus proposed"
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

      // PRD PF07/JN15 — "AI actions executed": Janus never creates a task
      // without this explicit user confirmation (JN09), and this is the
      // paper trail for that confirmation.
      if (source === "Janus proposed") {
        await recordJanusAction(
          user.id,
          session.user?.email ?? "unknown",
          "task_proposed",
          task.id,
          `Confirmed Janus-proposed task: "${task.title}"`
        );
      }

      return NextResponse.json(task, { status: 201 });
    }, { fresh: false });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
