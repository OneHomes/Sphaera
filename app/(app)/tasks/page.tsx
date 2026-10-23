import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withTenantPage } from "@/lib/withTenant";
import { formatDueLabel } from "@/lib/leadTransform";
import { TasksPage as TasksPageComponent } from "@/components/tasks/TasksPage";
import type { Task, TaskSource } from "@/lib/tasksData";

export const dynamic = "force-dynamic";

export default async function TasksRoute() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/sign-in");
  }

  return withTenantPage(session, async (authUser) => {
    const rows = await prisma.task.findMany({
      where: { assignedToId: authUser.id },
      orderBy: [{ completed: "asc" }, { dueAt: "asc" }],
    });

    const tasks: Task[] = rows.map((t) => {
      const dueLabel = t.completed
        ? "Completed"
        : formatDueLabel(t.dueAt);
      return {
        id: t.id,
        title: t.title,
        relatedTo: t.relatedTo ?? "—",
        dueLabel,
        isOverdue: !t.completed && dueLabel === "Overdue",
        source: t.source as TaskSource,
        completed: t.completed,
      };
    });

    return <TasksPageComponent initialTasks={tasks} />;
  });
}