"use client";

import { useState } from "react";
import type { Opportunity, OpportunityStage } from "@/lib/pipelineData";
import { formatMoney } from "@/lib/pipelineData";
import { OpportunityCard } from "./OpportunityCard";

const stageAccent: Partial<Record<OpportunityStage, string>> = {
  "Closed Won": "border-t-status-active",
  "Closed Lost": "border-t-status-inactive",
  Negotiation: "border-t-status-alert",
};

export function PipelineColumn({
  stage,
  opportunities,
  onDrop,
  onDragStart,
  onRequestApproval,
}: {
  stage: OpportunityStage;
  opportunities: Opportunity[];
  onDrop: (stage: OpportunityStage, id: string) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  onRequestApproval: (opportunity: Opportunity) => void;
}) {
  const [isOver, setIsOver] = useState(false);
  const totalValue = opportunities.reduce((sum, o) => sum + o.value, 0);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsOver(false);
        const id = e.dataTransfer.getData("text/plain");
        if (id) onDrop(stage, id);
      }}
      className={`flex w-64 shrink-0 flex-col rounded-xl border border-t-2 bg-base-900 transition ${
        stageAccent[stage] ?? "border-t-base-700"
      } ${isOver ? "border-status-active/60 bg-base-800" : "border-base-700"}`}
    >
      <div className="border-b border-base-700 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-ink-50">{stage}</h3>
          <span className="text-[11px] text-ink-500">
            {opportunities.length}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-ink-500">
          {formatMoney(totalValue)} total
        </p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {opportunities.map((opp) => (
          <OpportunityCard
            key={opp.id}
            opportunity={opp}
            onDragStart={onDragStart}
            onRequestApproval={onRequestApproval}
          />
        ))}
        {opportunities.length === 0 && (
          <p className="px-2 py-4 text-center text-[11px] text-ink-500">
            Drop here
          </p>
        )}
      </div>
    </div>
  );
}
