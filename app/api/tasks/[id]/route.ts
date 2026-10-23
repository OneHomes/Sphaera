import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateCurrentUser } from "@/lib/currentUser";
import { recordDailyActivity } from "@/lib/streaks";
import { withTenant, UnauthenticatedError } from "@/lib/withTenant";

const patchableFields = ["title", "completed", "dueAt"] as const;

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    return await withTenant(async (authUser, session) => {
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

      // PRD AEX 14.9 — completing a task is real activity worth crediting
      // toward the daily streak (see lib/streaks.ts).
      if (data.completed === true && !existing.completed) {
        try {
          await recordDailyActivity(user.id);
        } catch (err) {
          console.error("Streak update failed:", err);
        }
      }

      return NextResponse.json(updated);
    });
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
