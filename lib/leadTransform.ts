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
  row: PrismaLead & { assignedUser?: User | null; tags?: { tag: string }[] }
): Lead {
  return {
    id: row.id,
    uid: row.uid ?? undefined,
    tags: row.tags?.map((t) => t.tag) ?? [],
    name: row.name,
    contact: row.contact,
    email: row.email ?? undefined,
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

// HubSpot stores some engagement bodies (meeting notes especially) as
// raw HTML rather than plain text — synced verbatim into `summary` (see
// lib/hubspotActivitySync.ts), so without this the activity timeline
// showed literal `<html><head>...` markup as visible text. A full HTML
// parser is overkill for what's just a display cleanup; stripping tags
// and decoding the handful of entities HubSpot actually emits covers it.
function cleanSummaryForDisplay(raw: string): string {
  const stripped = raw
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|br|li|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return stripped.length > 600 ? `${stripped.slice(0, 600)}…` : stripped;
}

export function toUiTimelineEvent(row: PrismaTimelineEvent): TimelineEvent {
  return {
    id: row.id,
    type: row.type as TimelineEventType,
    timestamp: formatRelativeTime(row.occurredAt),
    summary: cleanSummaryForDisplay(row.summary),
  };
}