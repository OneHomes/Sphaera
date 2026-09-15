import type {
  Lead as PrismaLead,
  LeadNote as PrismaLeadNote,
  LeadTimelineEvent as PrismaTimelineEvent,
  User,
} from "@prisma/client";
import type {
  Lead,
  LeadPriority,
  LeadStage,
  EngagementLevel,
  AssignmentStatus,
} from "./leadData";
import type { Note, TimelineEvent, TimelineEventType } from "./leadProfileData";

// Real timestamps are stored in the database (DateTime columns). Human
// strings like "2 mins ago" or "Overdue" are computed at read time here,
// rather than stored — storing pre-formatted relative text would go stale
// the moment time passes.

export function formatRelativeTime(date: Date | null): string {
  if (!date) return "—";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

export function formatDueLabel(date: Date | null): string {
  if (!date) return "—";
  const diffMs = date.getTime() - Date.now();
  if (diffMs < 0) return "Overdue";
  const diffHr = diffMs / 3_600_000;
  if (diffHr < 24) {
    return `Today, ${date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }
  const diffDay = Math.round(diffHr / 24);
  if (diffDay === 1) return "Tomorrow";
  return `In ${diffDay} days`;
}

export function toUiLead(
  row: PrismaLead & { assignedUser?: User | null }
): Lead {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact,
    source: row.source,
    market: row.market,
    projectInterest: row.projectInterest,
    stage: row.stage as LeadStage,
    score: row.score,
    engagement: row.engagement as EngagementLevel,
    priority: row.priority as LeadPriority,
    lastInteraction: formatRelativeTime(row.lastInteractionAt),
    nextAction: row.nextAction ?? "—",
    nextActionDue: formatDueLabel(row.nextActionDueAt),
    assignment: row.assignment as AssignmentStatus,
    lockedUntilLabel:
      row.assignment === "Locked" && row.lockedUntil
        ? formatDueLabel(row.lockedUntil)
        : undefined,
    prioritizationReason: row.prioritizationReason ?? "",
    assignedUserId: row.assignedUserId ?? undefined,
    assignedUserName: row.assignedUser?.name ?? undefined,
  };
}

export function toUiNote(row: PrismaLeadNote): Note {
  return {
    id: row.id,
    author: row.author,
    timestamp: formatRelativeTime(row.createdAt),
    text: row.text,
  };
}

export function toUiTimelineEvent(row: PrismaTimelineEvent): TimelineEvent {
  return {
    id: row.id,
    type: row.type as TimelineEventType,
    timestamp: formatRelativeTime(row.occurredAt),
    summary: row.summary,
  };
}