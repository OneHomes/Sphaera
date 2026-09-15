"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  Mail,
  MessageCircle,
  CalendarPlus,
  ListPlus,
  UserCog,
  UserPlus,
  Sparkles,
  FileText,
} from "lucide-react";
import type { Lead, LeadStage } from "@/lib/leadData";
import { leadStages } from "@/lib/leadData";
import { StageBadge, PriorityBadge, ScoreBadge, AssignmentBadge } from "@/components/leads/LeadBadges";
import { LogInteractionModal } from "./LogInteractionModal";
import { ComposeMessageModal } from "./ComposeMessageModal";
import { ProposalModal } from "./ProposalModal";
import { AddTaskModal } from "@/components/tasks/AddTaskModal";

const actionButtons = [
  { icon: Phone, label: "Call" },
  { icon: Mail, label: "Email" },
  { icon: Sparkles, label: "Draft with Janus" },
  { icon: FileText, label: "Generate proposal" },
  { icon: MessageCircle, label: "WhatsApp" },
  { icon: CalendarPlus, label: "Propose meeting" },
  { icon: ListPlus, label: "Create task" },
  { icon: UserCog, label: "Request manager" },
] as const;

export function ProfileHeader({
  lead,
  currentUserId,
}: {
  lead: Lead;
  currentUserId: string;
}) {
  const router = useRouter();
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [logType, setLogType] = useState<"call" | "email" | "meeting" | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [showProposal, setShowProposal] = useState(false);

  function handleAction(label: (typeof actionButtons)[number]["label"]) {
    // PRD AE11 — "Call" now launches the real Call Workspace (timer,
    // real-time Sphaera/Manager assistance, auto-logged on end) rather
    // than just quick-logging a call that already happened. To log a
    // past call without the live workspace, open "Propose meeting" or
    // "Email" and switch the type selector inside that modal to Call.
    if (label === "Call") router.push(`/calls/${lead.id}`);
    else if (label === "Email") setLogType("email");
    else if (label === "Draft with Janus") setShowCompose(true);
    else if (label === "Generate proposal") setShowProposal(true);
    else if (label === "Propose meeting") setLogType("meeting");
    else if (label === "Create task") setShowCreateTask(true);
    // WhatsApp and Request manager remain unwired here: WhatsApp already
    // has a real backend (lib/whatsapp.ts) but it's driven from the
    // Messages surface, not this button yet. Request manager assistance
    // IS real now, but scoped to the Call Workspace (a live-call concept)
    // rather than this static profile page.
  }

  async function handleStageChange(newStage: LeadStage) {
    if (newStage === lead.stage) return;
    setIsUpdatingStage(true);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });
      if (!res.ok) throw new Error("Failed to update stage");
      router.refresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingStage(false);
    }
  }

  async function handleAssignToMe() {
    setIsAssigning(true);
    setAssignError(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedUserId: currentUserId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to assign lead");
      }
      router.refresh();
    } catch (err) {
      // PRD R08 (fair allocation): surface capacity/race-condition
      // rejections to the agent instead of failing silently.
      setAssignError(
        err instanceof Error ? err.message : "Failed to assign lead"
      );
    } finally {
      setIsAssigning(false);
    }
  }

  const isAssignedToMe = lead.assignedUserId === currentUserId;

  return (
    <div className="border-b border-base-700 px-6 py-4">
      <Link
        href="/leads"
        className="mb-3 inline-flex items-center gap-1.5 text-xs text-ink-500 hover:text-ink-300"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Lead Inbox
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-ink-50">{lead.name}</h1>
            <StageBadge stage={lead.stage} />
            <select
              value={lead.stage}
              disabled={isUpdatingStage}
              onChange={(e) => handleStageChange(e.target.value as LeadStage)}
              className="rounded-lg border border-base-700 bg-base-900 px-2 py-1 text-xs text-ink-300 outline-none disabled:opacity-50"
            >
              {leadStages.map((stage) => (
                <option key={stage} value={stage}>
                  Move to: {stage}
                </option>
              ))}
            </select>
            <PriorityBadge priority={lead.priority} />
          </div>
          <p className="mt-1 text-sm text-ink-500">
            {lead.contact} · {lead.source} · {lead.market}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs">
            {lead.assignedUserName ? (
              <>
                <span
                  className={isAssignedToMe ? "text-status-active" : "text-ink-500"}
                >
                  Assigned to: {lead.assignedUserName}
                </span>
                <AssignmentBadge status={lead.assignment} />
                {lead.assignment === "Locked" && lead.lockedUntilLabel && (
                  <span className="text-status-alert">
                    · Locked until {lead.lockedUntilLabel} — log a call, email, or
                    meeting to unlock early
                  </span>
                )}
              </>
            ) : (
              <button
                onClick={handleAssignToMe}
                disabled={isAssigning}
                className="flex items-center gap-1 text-ink-500 hover:text-ink-300 disabled:opacity-50"
              >
                <UserPlus className="h-3 w-3" />
                {isAssigning ? "Assigning…" : "Assign to me"}
              </button>
            )}
          </p>
          {assignError && (
            <p className="mt-1 text-xs text-status-inactive">{assignError}</p>
          )}
        </div>
        <ScoreBadge score={lead.score} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {actionButtons.map(({ icon: Icon, label }) => (
          <button
            key={label}
            onClick={() => handleAction(label)}
            className="flex items-center gap-1.5 rounded-lg border border-base-700 bg-base-900 px-3 py-1.5 text-xs text-ink-300 transition hover:border-base-600 hover:text-ink-50"
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {logType && (
        <LogInteractionModal
          leadId={lead.id}
          defaultType={logType}
          onClose={() => setLogType(null)}
          onLogged={() => router.refresh()}
        />
      )}

      {showCreateTask && (
        <AddTaskModal
          heading="Create task"
          defaultRelatedTo={lead.name}
          leadId={lead.id}
          onClose={() => setShowCreateTask(false)}
        />
      )}

      {showCompose && (
        <ComposeMessageModal
          leadId={lead.id}
          onClose={() => setShowCompose(false)}
          onSent={() => router.refresh()}
        />
      )}

      {showProposal && (
        <ProposalModal
          leadId={lead.id}
          onClose={() => setShowProposal(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}