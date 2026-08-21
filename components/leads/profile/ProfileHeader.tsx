"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  Mail,
  MessageCircle,
  CalendarPlus,
  ListPlus,
  UserCog,
} from "lucide-react";
import type { Lead } from "@/lib/leadData";
import { StageBadge, PriorityBadge, ScoreBadge } from "@/components/leads/LeadBadges";

const actionButtons = [
  { icon: Phone, label: "Call" },
  { icon: Mail, label: "Email" },
  { icon: MessageCircle, label: "WhatsApp" },
  { icon: CalendarPlus, label: "Propose meeting" },
  { icon: ListPlus, label: "Create task" },
  { icon: UserCog, label: "Request manager" },
];

export function ProfileHeader({ lead }: { lead: Lead }) {
  function handleAction(label: string) {
    // TODO: wire each action to its real channel/API once available:
    // Call -> telephony provider, Email -> Gmail/M365 send, WhatsApp ->
    // messaging connector, Propose meeting -> calendar, Create task ->
    // Task entity, Request manager -> AE10 manager-assist notification.
    console.log(`Contact action: ${label} for ${lead.name}`);
  }

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
            <PriorityBadge priority={lead.priority} />
          </div>
          <p className="mt-1 text-sm text-ink-500">
            {lead.contact} · {lead.source} · {lead.market}
          </p>
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
