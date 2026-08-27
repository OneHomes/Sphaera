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
} from "lucide-react";
import type { Lead, LeadStage } from "@/lib/leadData";
import { leadStages } from "@/lib/leadData";
import { StageBadge, PriorityBadge, ScoreBadge } from "@/components/leads/LeadBadges";

const actionButtons = [
  { icon: Phone, label: "Call" },
  { icon: Mail, label: "Email" },
  { icon: MessageCircle, label: "WhatsApp" },
  { icon: CalendarPlus, label: "Propose meeting" },
  { icon: ListPlus, label: "Create task" },
  { icon: UserCog, label: "Request manager" },
];

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

  function handleAction(label: string) {
    // TODO: wire each action to its real channel/API once available:
    // Call -> telephony provider, Email -> Gmail/M365 send, WhatsApp ->
    // messaging connector, Propose meeting -> calendar, Create task ->
    // Task entity, Request manager -> AE10 manager-assist notification.
    console.log(`Contact action: ${label} for ${lead.name}`);
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
          <p className="mt-1 text-xs">
            {lead.assignedUserName ? (
              <span
                className={isAssignedToMe ? "text-status-active" : "text-ink-500"}
              >
                Assigned to: {lead.assignedUserName}
              </span>
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
    </div>
  );
}