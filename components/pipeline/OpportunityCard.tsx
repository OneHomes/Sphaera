"use client";

import { UserCog, UserPlus } from "lucide-react";
import type { Opportunity } from "@/lib/pipelineData";
import { formatMoney } from "@/lib/pipelineData";

export function OpportunityCard({
  opportunity,
  currentUserId,
  onDragStart,
  onRequestApproval,
  onAssignToMe,
}: {
  opportunity: Opportunity;
  currentUserId: string;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  onRequestApproval: (opportunity: Opportunity) => void;
  onAssignToMe: (opportunity: Opportunity) => void;
}) {
  const isAssignedToMe = opportunity.assignedUserId === currentUserId;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, opportunity.id)}
      className="cursor-grab rounded-lg border border-base-700 bg-base-800 p-3 active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-ink-50">
            {opportunity.leadName}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-500">
            {opportunity.contact}
          </p>
        </div>
        <span className="shrink-0 text-xs font-semibold text-status-active">
          {formatMoney(opportunity.value)}
        </span>
      </div>

      <p
        className="mt-2 truncate text-[11px] text-ink-300"
        title={opportunity.projectInterest}
      >
        {opportunity.projectInterest}
      </p>

      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-500">
        <span>{opportunity.probability}% probability</span>
        <span>{opportunity.expectedCloseDate}</span>
      </div>

      {opportunity.lossReason && (
        <p className="mt-1.5 text-[11px] text-status-inactive">
          Lost: {opportunity.lossReason}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-base-700 pt-2">
        <span className="text-[11px] text-ink-300">
          Next: {opportunity.nextAction}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onRequestApproval(opportunity)}
            title="Request manager approval"
            className="text-ink-500 hover:text-ink-300"
          >
            <UserCog className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-1.5 text-[11px]">
        {opportunity.assignedUserName ? (
          <span
            className={
              isAssignedToMe ? "text-status-active" : "text-ink-500"
            }
          >
            Assigned: {opportunity.assignedUserName}
          </span>
        ) : (
          <button
            onClick={() => onAssignToMe(opportunity)}
            className="flex items-center gap-1 text-ink-500 hover:text-ink-300"
          >
            <UserPlus className="h-3 w-3" />
            Assign to me
          </button>
        )}
      </div>
    </div>
  );
}
