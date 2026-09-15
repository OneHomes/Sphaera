import type {
  LeadPriority,
  LeadStage,
  EngagementLevel,
  AssignmentStatus,
} from "@/lib/leadData";
import { scoreBand, leadStageRank } from "@/lib/leadData";

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

// Colored by real funnel rank (lib/leadData.ts leadStageRank) rather
// than a per-status lookup, so any real Salesforce status — known or
// not yet seen — gets a sensible color instead of "undefined".
function stageColorClass(stage: LeadStage): string {
  const rank = leadStageRank[stage];
  if (rank === undefined) return "bg-base-700 text-ink-300"; // unrecognized status — neutral, not an error
  if (rank < 0) return "bg-status-inactive/15 text-status-inactive"; // Not Interested / Cancelled / Remove from DB
  if (rank === 0) return "bg-base-700 text-ink-300"; // New
  if (rank <= 2) return "bg-sky-500/15 text-sky-400"; // contacted / interested
  if (rank <= 4) return "bg-violet-500/15 text-violet-400"; // meeting-related
  if (rank <= 6) return "bg-status-active/15 text-status-active"; // qualified / validated
  return "bg-tier-gold/15 text-tier-gold"; // negotiation through closing
}

export function StageBadge({ stage }: { stage: LeadStage }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${stageColorClass(stage)}`}
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
