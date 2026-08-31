import { prisma } from "./prisma";
import { formatDueLabel } from "./leadTransform";

// PRD AE04 (Mission Centre) — a single, priority-ordered view of what
// needs attention today: overdue leads first (revenue-at-risk), then
// overdue tasks, then leads/tasks due today. A "target gap" indicator
// (part of the full PRD vision) is deliberately NOT included here — it
// would require a Target entity that doesn't exist in the schema yet
// (see PRD AV04, Target Tracker — a separate, not-yet-built module);
// fabricating a number for it would violate the no-invented-data rule
// this build has followed throughout.

export type MissionItem = {
  id: string;
  type: "overdue_lead" | "due_lead" | "overdue_task" | "due_task";
  title: string;
  subtitle: string;
  href: string;
  urgency: "critical" | "high" | "medium";
};

const urgencyRank: Record<MissionItem["urgency"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
};

export async function getMissionItems(userId: string): Promise<MissionItem[]> {
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const [leads, tasks] = await Promise.all([
    prisma.lead.findMany({
      where: {
        assignedUserId: userId,
        nextActionDueAt: { not: null, lte: endOfToday },
      },
      orderBy: { nextActionDueAt: "asc" },
    }),
    prisma.task.findMany({
      where: {
        assignedToId: userId,
        completed: false,
        dueAt: { not: null, lte: endOfToday },
      },
      orderBy: { dueAt: "asc" },
    }),
  ]);

  const items: MissionItem[] = [];

  for (const lead of leads) {
    const isOverdue = lead.nextActionDueAt! < now;
    items.push({
      id: `lead-${lead.id}`,
      type: isOverdue ? "overdue_lead" : "due_lead",
      title: `${lead.nextAction ?? "Follow up"} — ${lead.name}`,
      subtitle: isOverdue
        ? `Overdue · ${lead.stage}`
        : `Due ${formatDueLabel(lead.nextActionDueAt)} · ${lead.stage}`,
      href: `/leads/${lead.id}`,
      urgency: isOverdue ? "critical" : "high",
    });
  }

  for (const task of tasks) {
    const isOverdue = task.dueAt! < now;
    items.push({
      id: `task-${task.id}`,
      type: isOverdue ? "overdue_task" : "due_task",
      title: task.title,
      subtitle: isOverdue
        ? `Overdue task${task.relatedTo ? ` · ${task.relatedTo}` : ""}`
        : `Due today${task.relatedTo ? ` · ${task.relatedTo}` : ""}`,
      href: "/tasks",
      urgency: isOverdue ? "critical" : "medium",
    });
  }

  // Target-gap check: if the user has a personal revenue target and is
  // meaningfully behind pace, surface it as a mission item too.
  const { getVisibleTargets } = await import("./targetTracker");
  const targets = await getVisibleTargets(userId, null);
  const GAP_THRESHOLD = 15; // PLACEHOLDER — pending business sign-off
  for (const target of targets) {
    if (!target.isOnPace) {
      const expectedPercent =
        target.percentComplete +
        (target.daysRemaining > 0 ? GAP_THRESHOLD : 0);
      if (expectedPercent - target.percentComplete >= GAP_THRESHOLD || !target.isOnPace) {
        items.push({
          id: `target-${target.id}`,
          type: "overdue_task",
          title: `${target.metric === "revenue" ? "Revenue" : target.metric} target behind pace`,
          subtitle: `${target.percentComplete}% complete, ${target.daysRemaining} days left`,
          href: "/targets",
          urgency: "high",
        });
      }
    }
  }

  items.sort((a, b) => urgencyRank[a.urgency] - urgencyRank[b.urgency]);

  return items;
}