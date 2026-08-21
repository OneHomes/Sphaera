"use client";

import { useState } from "react";
import {
  initialOpportunities,
  pipelineStages,
  type Opportunity,
  type OpportunityStage,
} from "@/lib/pipelineData";
import { PipelineColumn } from "./PipelineColumn";
import { LossReasonModal } from "./LossReasonModal";

type PendingLossMove = {
  opportunityId: string;
  leadName: string;
};

export function PipelineBoard() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>(
    initialOpportunities
  );
  const [pendingLossMove, setPendingLossMove] =
    useState<PendingLossMove | null>(null);

  function handleDragStart(
    e: React.DragEvent<HTMLDivElement>,
    id: string
  ) {
    e.dataTransfer.setData("text/plain", id);
  }

  function moveOpportunity(
    id: string,
    stage: OpportunityStage,
    lossReason?: string
  ) {
    setOpportunities((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              stage,
              lossReason: stage === "Closed Lost" ? lossReason : undefined,
            }
          : o
      )
    );
    // TODO: on real move, call the stage-update API (PRD Section 4.3
    // "Closed Revenue Loop" — this should also update AEX event stream
    // and trigger any downstream Janus/notification hooks.
  }

  function handleDrop(targetStage: OpportunityStage, id: string) {
    const opp = opportunities.find((o) => o.id === id);
    if (!opp || opp.stage === targetStage) return;

    if (targetStage === "Closed Lost") {
      setPendingLossMove({ opportunityId: id, leadName: opp.leadName });
      return;
    }

    moveOpportunity(id, targetStage);
  }

  function handleRequestApproval(opportunity: Opportunity) {
    // TODO: wire to a real manager-approval workflow (PRD Section 4.9 —
    // "Human Authority Over Material Actions" requires explicit approval
    // for anything altering commercial terms).
    console.log(`Manager approval requested for ${opportunity.leadName}`);
  }

  const totalPipelineValue = opportunities
    .filter((o) => o.stage !== "Closed Won" && o.stage !== "Closed Lost")
    .reduce((sum, o) => sum + o.value, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-base-700 px-6 py-4">
        <h1 className="text-xl font-semibold text-ink-50">Pipeline</h1>
        <p className="mt-1 text-sm text-ink-500">
          {opportunities.length} opportunities · $
          {(totalPipelineValue / 1_000_000).toFixed(2)}M active pipeline
        </p>
      </div>

      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-3">
          {pipelineStages.map((stage) => (
            <PipelineColumn
              key={stage}
              stage={stage}
              opportunities={opportunities.filter((o) => o.stage === stage)}
              onDrop={handleDrop}
              onDragStart={handleDragStart}
              onRequestApproval={handleRequestApproval}
            />
          ))}
        </div>
      </div>

      {pendingLossMove && (
        <LossReasonModal
          leadName={pendingLossMove.leadName}
          onCancel={() => setPendingLossMove(null)}
          onConfirm={(reason) => {
            moveOpportunity(pendingLossMove.opportunityId, "Closed Lost", reason);
            setPendingLossMove(null);
          }}
        />
      )}
    </div>
  );
}
