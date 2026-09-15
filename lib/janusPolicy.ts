import { logAudit } from "./auditLog";

// PRD JN15 — Action Policy and Safety. Every material action Janus
// contributed to must pass through this single checkpoint before (or
// immediately after) being persisted, so Apex Vision's governance log
// has one consistent, filterable trail of AI-assisted actions — distinct
// from a human acting unassisted. All actions routed through here today
// are low-risk/internal (a confirmed task, a saved proposal draft) that
// already required human review/confirmation via their own UI before
// this is ever called (JN09 task creation, AE16 proposal save) — nothing
// in this build lets Janus execute a high-impact action (external
// comms, reassignment, target changes) without going through the normal
// human-driven endpoint for that action, consistent with PRD 4.9's
// human-authority requirement. This function doesn't gate/block — it
// records; the actual gate is "there's no direct-execute endpoint for
// high-impact actions" (see the existing pattern: compose only drafts,
// interactions/route.ts is what actually persists a "sent" message).
export type JanusActionType = "task_proposed" | "proposal_generated" | "focus_confirmed";

export async function recordJanusAction(
  actorId: string,
  actorEmail: string,
  actionType: JanusActionType,
  targetId: string | null,
  details: string
): Promise<void> {
  await logAudit({
    actorId,
    actorEmail,
    action: "ai_action_executed",
    targetId: targetId ?? undefined,
    details: `[${actionType}] ${details}`,
  });
}
