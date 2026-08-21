import type {
  LeadPriority,
  LeadStage,
  EngagementLevel,
  AssignmentStatus,
} from "@/lib/leadData";
import { scoreBand } from "@/lib/leadData";

const priorityStyles: Record<LeadPriority, string> = {
  High: "bg-status-inactive/15 text-status-inactive",
  Medium: "bg-status-alert/15 text-status-alert",
  Low: "bg-status-active/15 text-status-active",
};

export function PriorityBadge({ priority }: { priority: LeadPriority }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${priorityStyles[priority]}`}
    >
      {priority}
    </span>
  );
}

const stageStyles: Record<LeadStage, string> = {
  New: "bg-base-700 text-ink-300",
  Contacted: "bg-sky-500/15 text-sky-400",
  Qualified: "bg-status-active/15 text-status-active",
  "Meeting Booked": "bg-violet-500/15 text-violet-400",
  Negotiation: "bg-status-alert/15 text-status-alert",
};

export function StageBadge({ stage }: { stage: LeadStage }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${stageStyles[stage]}`}
    >
      {stage}
    </span>
  );
}

const scoreBandStyles = {
  Hot: "text-status-inactive",
  Warm: "text-status-alert",
  Cool: "text-ink-500",
};

export function ScoreBadge({ score }: { score: number }) {
  const band = scoreBand(score);
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-sm font-semibold ${scoreBandStyles[band]}`}>
        {score}
      </span>
      <span className="text-[10px] text-ink-500">{band}</span>
    </div>
  );
}

const engagementDots: Record<EngagementLevel, number> = {
  High: 3,
  Medium: 2,
  Low: 1,
};

export function EngagementIndicator({ level }: { level: EngagementLevel }) {
  const active = engagementDots[level];
  return (
    <div className="flex items-center gap-0.5" title={`Engagement: ${level}`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`h-1.5 w-1.5 rounded-full ${
            i <= active ? "bg-status-active" : "bg-base-700"
          }`}
        />
      ))}
    </div>
  );
}

const assignmentStyles: Record<AssignmentStatus, string> = {
  Assigned: "bg-status-active/15 text-status-active",
  Locked: "bg-status-alert/15 text-status-alert",
  Unassigned: "bg-base-700 text-ink-300",
};

export function AssignmentBadge({ status }: { status: AssignmentStatus }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${assignmentStyles[status]}`}
    >
      {status}
    </span>
  );
}
